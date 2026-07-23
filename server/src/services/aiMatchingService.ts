import { InferenceClient } from '@huggingface/inference';
import FreelancerProfile from '../models/FreelancerProfile';
import { IGig, IFreelancerProfile, MatchScore } from '../types';
import { Types } from 'mongoose';

class AIMatchingService {
  private client: InferenceClient | null = null;

  private getClient(): InferenceClient {
    if (!this.client) {
      this.client = new InferenceClient(process.env.HF_ACCESS_TOKEN || '');
    }
    return this.client;
  }

  async matchFreelancersToGig(gig: IGig, limit: number = 10): Promise<MatchScore[]> {
    try {
      // Step 1: Find freelancers with matching skills (database-level filtering)
      const matchingProfiles = await FreelancerProfile.find({
        'skills.name': { $in: gig.skills.map((s) => new RegExp(s, 'i')) },
        availability: { $ne: 'unavailable' },
      })
        .populate('user', 'firstName lastName email avatar isActive isBanned')
        .limit(50)
        .lean();

      if (matchingProfiles.length === 0) {
        return [];
      }

      // Step 2: Score each freelancer
      const scores: MatchScore[] = matchingProfiles.map((profile) => {
        const score = this.calculateMatchScore(profile as IFreelancerProfile, gig);
        return {
          freelancerId: profile.user as unknown as Types.ObjectId,
          score: score.total,
          reasons: score.reasons,
        };
      });

      // Step 3: Sort by score descending and limit
      scores.sort((a, b) => b.score - a.score);

      return scores.slice(0, limit);
    } catch (error) {
      console.error('AI matching error:', error);
      return this.fallbackMatching(gig, limit);
    }
  }

  private calculateMatchScore(
    profile: IFreelancerProfile,
    gig: IGig
  ): { total: number; reasons: string[] } {
    let total = 0;
    const reasons: string[] = [];

    // Skill match (0-40 points)
    const profileSkillNames = (profile.skills || []).map((s) =>
      s.name.toLowerCase()
    );
    const gigSkills = gig.skills.map((s) => s.toLowerCase());
    const matchedSkills = gigSkills.filter((gs) =>
      profileSkillNames.some(
        (ps) => ps.includes(gs) || gs.includes(ps)
      )
    );
    const skillScore = (matchedSkills.length / gigSkills.length) * 40;
    total += skillScore;
    if (matchedSkills.length > 0) {
      reasons.push(`Matches ${matchedSkills.length}/${gigSkills.length} required skills`);
    }

    // Experience level match (0-15 points)
    const avgProficiency = this.getAverageProficiency(profile.skills || []);
    const expLevelMap: Record<string, number> = {
      entry: 1,
      intermediate: 2,
      expert: 3,
    };
    const requiredLevel = expLevelMap[gig.experienceLevel] || 1;
    if (avgProficiency >= requiredLevel) {
      total += 15;
      reasons.push('Meets experience level requirements');
    } else if (avgProficiency >= requiredLevel - 1) {
      total += 8;
      reasons.push('Close to required experience level');
    }

    // Rating score (0-15 points)
    if (profile.averageRating > 0) {
      const ratingScore = (profile.averageRating / 5) * 15;
      total += ratingScore;
      reasons.push(`Rating: ${profile.averageRating.toFixed(1)}/5`);
    }

    // Completed gigs (0-10 points)
    const gigScore = Math.min(10, profile.completedGigs * 1);
    total += gigScore;
    if (profile.completedGigs > 0) {
      reasons.push(`${profile.completedGigs} gigs completed`);
    }

    // Budget compatibility (0-10 points)
    if (gig.budgetType === 'hourly' && profile.hourlyRate > 0) {
      if (
        profile.hourlyRate >= gig.budgetMin &&
        profile.hourlyRate <= gig.budgetMax
      ) {
        total += 10;
        reasons.push('Hourly rate within budget');
      } else if (profile.hourlyRate <= gig.budgetMax * 1.2) {
        total += 5;
        reasons.push('Hourly rate close to budget');
      }
    } else {
      total += 5; // Default partial score for fixed projects
    }

    // Response time bonus (0-5 points)
    if (profile.responseTime > 0 && profile.responseTime <= 2) {
      total += 5;
      reasons.push('Fast response time');
    } else if (profile.responseTime <= 6) {
      total += 3;
    }

    // Availability bonus (0-5 points)
    if (profile.availability === 'available') {
      total += 5;
      reasons.push('Currently available');
    } else if (profile.availability === 'busy') {
      total += 2;
    }

    return { total: Math.round(total * 100) / 100, reasons };
  }

  private getAverageProficiency(
    skills: IFreelancerProfile['skills']
  ): number {
    if (skills.length === 0) return 0;
    const levelMap: Record<string, number> = {
      beginner: 1,
      intermediate: 2,
      advanced: 3,
      expert: 4,
    };
    const sum = skills.reduce(
      (acc, s) => acc + (levelMap[s.proficiency] || 1),
      0
    );
    return sum / skills.length;
  }

  async generateGigDescription(
    title: string,
    skills: string[],
    category: string
  ): Promise<string> {
    try {
      const client = this.getClient();
      const prompt = `Write a professional job description for a gig titled "${title}" in the "${category}" category requiring skills: ${skills.join(', ')}. Include responsibilities, requirements, and deliverables.`;

      const result = await client.textGeneration({
        model: 'mistralai/Mistral-7B-Instruct-v0.3',
        inputs: prompt,
        parameters: {
          max_new_tokens: 500,
          temperature: 0.7,
        },
      });

      return result.generated_text || 'Unable to generate description at this time.';
    } catch (error) {
      console.error('AI description generation error:', error);
      return `Looking for a skilled professional to work on: ${title}. Required skills: ${skills.join(', ')}.`;
    }
  }

  async analyzeProposal(
    coverLetter: string,
    gigDescription: string
  ): Promise<{ relevanceScore: number; feedback: string }> {
    try {
      const client = this.getClient();
      const prompt = `Rate the relevance (0-100) of this proposal to the job and provide brief feedback.\n\nJob: ${gigDescription.substring(0, 500)}\n\nProposal: ${coverLetter.substring(0, 500)}\n\nResponse format: Score: [number]\nFeedback: [text]`;

      const result = await client.textGeneration({
        model: 'mistralai/Mistral-7B-Instruct-v0.3',
        inputs: prompt,
        parameters: {
          max_new_tokens: 200,
          temperature: 0.3,
        },
      });

      const text = result.generated_text || '';
      const scoreMatch = text.match(/Score:\s*(\d+)/);
      const feedbackMatch = text.match(/Feedback:\s*(.+)/s);

      return {
        relevanceScore: scoreMatch ? parseInt(scoreMatch[1], 10) : 50,
        feedback: feedbackMatch ? feedbackMatch[1].trim() : 'Analysis unavailable.',
      };
    } catch (error) {
      console.error('Proposal analysis error:', error);
      return {
        relevanceScore: 50,
        feedback: 'Unable to analyze proposal at this time.',
      };
    }
  }

  private async fallbackMatching(
    gig: IGig,
    limit: number
  ): Promise<MatchScore[]> {
    const profiles = await FreelancerProfile.find({
      'skills.name': { $in: gig.skills.map((s) => new RegExp(s, 'i')) },
    })
      .populate('user', 'firstName lastName')
      .sort({ averageRating: -1, completedGigs: -1 })
      .limit(limit)
      .lean();

    return profiles.map((p) => ({
      freelancerId: p.user as unknown as Types.ObjectId,
      score: p.averageRating * 20,
      reasons: ['Matched by skills'],
    }));
  }
}

export default new AIMatchingService();
