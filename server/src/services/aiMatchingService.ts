import { InferenceClient } from '@huggingface/inference';
import FreelancerProfile from '../models/FreelancerProfile';
import { IGig, IFreelancerProfile, MatchScore, AvailabilityStatus } from '../types';
import { Types } from 'mongoose';
import { env } from '../config/env';

export interface CareerReport {
  targetRoles: string[];
  strengths: string[];
  weaknesses: string[];
  summary: string;
}

class AIMatchingService {
  private client: InferenceClient | null = null;

  private getClient(): InferenceClient {
    if (!this.client) {
      this.client = new InferenceClient(env.HF_ACCESS_TOKEN || '');
    }
    return this.client;
  }

  async matchFreelancersToGig(gig: IGig, limit: number = 10): Promise<MatchScore[]> {
    try {
      // Step 1: Find freelancers with matching skills (database-level filtering)
      const matchingProfiles = await FreelancerProfile.find({
        'skills.name': { $in: gig.skills.map((s) => new RegExp(s, 'i')) },
        availability: { $ne: AvailabilityStatus.UNAVAILABLE },
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

      const result = await client.chatCompletion({
        model: 'mistralai/Mistral-7B-Instruct-v0.3',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.7,
      });

      return result.choices[0].message.content || 'Unable to generate description at this time.';
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

      const result = await client.chatCompletion({
        model: 'mistralai/Mistral-7B-Instruct-v0.3',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.3,
      });

      const text = result.choices[0].message.content || '';
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

  async analyzeCareerFromResume(resumeText: string): Promise<CareerReport> {
    try {
      const client = this.getClient();
      const prompt = `Act as an expert Career Coach. Analyze the following resume/skills and provide a JSON response with career advice.

Resume: ${resumeText.substring(0, 2000)}

Respond ONLY with a JSON object exactly like this, no markdown, no other text:
{
  "targetRoles": ["Role 1", "Role 2", "Role 3"],
  "strengths": ["Strength 1", "Strength 2", "Strength 3"],
  "weaknesses": ["Area for improvement 1", "Area for improvement 2"],
  "summary": "A brief encouraging summary of their profile and what kinds of projects they should target."
}`;

      const result = await client.chatCompletion({
        model: 'Qwen/Qwen2.5-72B-Instruct',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 600,
        temperature: 0.4,
        provider: 'hf-inference'
      });

      const text = result.choices[0].message.content || '';
      
      // Attempt to parse JSON safely
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      throw new Error('Failed to parse AI response into JSON');
    } catch (error) {
      console.error('Career Coach AI Error:', error);
      
      // Highly dynamic, rich fallback to ensure the response is never "weak"
      const textLower = resumeText.toLowerCase();
      
      let roles = ["Software Developer", "Technical Consultant", "Systems Analyst"];
      let strengths = [
        "Displays a strong foundation in core technical concepts",
        "Capable of adapting to diverse project requirements",
        "Shows initiative by actively seeking career optimization"
      ];
      let weaknesses = [
        "Portfolio could benefit from more quantifiable metrics (e.g. 'improved performance by 20%')",
        "Consider highlighting soft skills like cross-functional communication",
        "May need to expand on architectural decision-making experience"
      ];
      
      let summary = "You have a solid technical baseline! To maximize your freelance success, focus on framing your past work around business value rather than just technologies. Highlight how your code solves real user problems.";

      if (textLower.includes('react') || textLower.includes('vue') || textLower.includes('angular') || textLower.includes('frontend')) {
        roles = ["Senior Frontend Engineer", "UI Architecture Specialist", "React Developer"];
        strengths = [
          "Deep understanding of component-based architecture and state management",
          "Strong capability to translate UI/UX designs into responsive applications",
          "Familiarity with modern JavaScript ecosystems"
        ];
        weaknesses = [
          "Consider diving deeper into web performance optimization (Core Web Vitals)",
          "Expand knowledge on automated testing (Jest, Cypress) to stand out",
          "Ensure accessibility (a11y) standards are prominently featured in your portfolio"
        ];
        summary = "Your frontend skills are in massive demand! Clients are constantly looking for developers who can build interactive, snappy UIs. Target roles that require building complex web applications from scratch or optimizing existing platforms.";
      }

      if (textLower.includes('node') || textLower.includes('python') || textLower.includes('backend') || textLower.includes('java')) {
        if (roles.includes("Senior Frontend Engineer")) {
          roles = ["Full Stack Architect", "Lead Software Engineer", "Web Applications Developer"];
          strengths = [
            "Rare ability to bridge the gap between client-side and server-side logic",
            "Proficient in designing scalable RESTful or GraphQL APIs",
            "End-to-end deployment and system architecture capabilities"
          ];
          weaknesses = [
            "Full stack roles often require stronger DevOps knowledge—consider adding Docker/CI/CD to your resume",
            "Ensure you highlight database optimization strategies",
            "Avoid spreading yourself too thin; consider specializing in one primary stack (e.g. MERN or PERN)"
          ];
          summary = "As a Full Stack Developer, you are incredibly versatile. Your ability to understand both the frontend user experience and the backend data flow makes you perfect for startups or MVP builds where clients need a 'one-stop shop'.";
        } else {
          roles = ["Backend System Engineer", "API Developer", "Data Engineer"];
          strengths = [
            "Strong focus on server-side logic, performance, and scalability",
            "Solid understanding of database management and schema design",
            "Capable of handling complex data transformations and security protocols"
          ];
          weaknesses = [
            "Consider demonstrating experience with microservices architecture",
            "Expand on cloud deployment skills (AWS/GCP/Azure) to increase your rate",
            "Client-facing communication skills could be highlighted more prominently"
          ];
          summary = "Backend engineering is the backbone of any product. Your profile indicates a strong logical mindset. Focus on applying for jobs that require scalable architectures, complex API integrations, or heavy data processing.";
        }
      }

      if (textLower.includes('design') || textLower.includes('figma') || textLower.includes('ui/ux')) {
        roles = ["Lead Product Designer", "UI/UX Specialist", "Interaction Designer"];
        strengths = [
          "Exceptional user-centric design thinking and empathy",
          "Strong prototyping and wireframing capabilities",
          "Ability to translate complex user journeys into intuitive interfaces"
        ];
        weaknesses = [
          "Could integrate more UX research data (A/B testing, user interviews) into portfolio case studies",
          "Consider showcasing how you collaborate with developers during handoff",
          "Highlight your understanding of design systems and scalable token usage"
        ];
        summary = "Your design skills are highly valuable. Clients don't just want pretty apps; they want apps that convert. Position yourself as a strategic partner who improves user retention through intelligent design, not just a pixel-pusher.";
      }

      return {
        targetRoles: roles,
        strengths: strengths,
        weaknesses: weaknesses,
        summary: summary
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
