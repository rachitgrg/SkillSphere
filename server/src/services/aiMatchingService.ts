import { InferenceClient } from '@huggingface/inference';
import { Types } from 'mongoose';
import FreelancerProfile from '../models/FreelancerProfile';
import Gig from '../models/Gig';
import User from '../models/User';
import Proposal from '../models/Proposal';
import {
  IGig,
  IFreelancerProfile,
  IGeoLocation,
  AvailabilityStatus,
  GigStatus,
  ProficiencyLevel,
} from '../types';
import { env } from '../config/env';
import { containsRegex } from '../utils/helpers';
import embeddingService, { SimilaritySource } from './embeddingService';

/**
 * Chat model for the career coach. Served through HF Inference Providers (featherless-ai, deepinfra);
 * it is not on the hf-inference provider, so the provider is left to HF's automatic routing.
 */
export const CAREER_MODEL = 'Qwen/Qwen2.5-72B-Instruct';

export interface CareerReport {
  targetRoles: string[];
  strengths: string[];
  weaknesses: string[];
  summary: string;
  source: SimilaritySource;
}

/**
 * Match score weights (sum = 1). Each component is 0–1; the final score is reported as 0–100.
 *  - skill:        semantic similarity of gig vs profile embeddings (MiniLM cosine), or skill overlap
 *                  (coverage + Jaccard) when Hugging Face is unavailable
 *  - rating:       Bayesian average rating / 5, prior of BAYES_PRIOR_REVIEWS reviews at the platform mean
 *  - proximity:    onsite/hybrid gigs: 1 − min(distanceKm, 50) / 50; remote gigs: 1
 *  - experience:   average proficiency on the gig's skills vs the gig's experience level
 *  - budget:       hourly rate (or cheapest package for fixed gigs) vs the gig's budgetMax
 *  - availability: available = 1, busy = 0.5
 *  - verified freelancers get a flat VERIFIED_BONUS on top (capped at 1)
 */
export const MATCH_WEIGHTS = {
  skill: 0.45,
  rating: 0.2,
  proximity: 0.15,
  experience: 0.1,
  budget: 0.05,
  availability: 0.05,
} as const;

export type MatchBreakdown = Record<keyof typeof MATCH_WEIGHTS, number>;

const BAYES_PRIOR_REVIEWS = 5;
const DEFAULT_PLATFORM_RATING = 4;
const MAX_DISTANCE_KM = 50;
const VERIFIED_BONUS = 0.03;

const PROFICIENCY_VALUE: Record<string, number> = {
  [ProficiencyLevel.BEGINNER]: 1,
  [ProficiencyLevel.INTERMEDIATE]: 2,
  [ProficiencyLevel.ADVANCED]: 3,
  [ProficiencyLevel.EXPERT]: 4,
};
/** Average proficiency a gig's experience level asks for, on the scale above. */
const REQUIRED_PROFICIENCY: Record<string, number> = { entry: 1, intermediate: 2.5, expert: 3.5 };

type ScoredGig = Pick<
  IGig,
  'title' | 'description' | 'skills' | 'category' | 'experienceLevel' | 'budgetType' | 'budgetMax' | 'locationType' | 'location'
> & { embedding?: number[] };

type ScoredProfile = Pick<
  IFreelancerProfile,
  'title' | 'headline' | 'skills' | 'averageRating' | 'totalReviews' | 'hourlyRate' | 'availability' | 'location' | 'milestonePricing'
> & { embedding?: number[]; verification?: { status?: string } };

export interface MatchResult {
  score: number;
  breakdown: MatchBreakdown;
  matchedSkills: string[];
  distanceKm?: number;
  reasons: string[];
  source: SimilaritySource;
}

/** Great-circle distance between two GeoJSON points, in km. */
export const distanceKm = (a: IGeoLocation, b: IGeoLocation): number => {
  const [lng1, lat1] = a.coordinates;
  const [lng2, lat2] = b.coordinates;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};

const hasPoint = (loc?: IGeoLocation): loc is IGeoLocation => Array.isArray(loc?.coordinates) && loc.coordinates.length === 2;

const round = (n: number, digits = 2) => Math.round(n * 10 ** digits) / 10 ** digits;

/** Scores one profile against one gig. Pure; `platformRating` is the Bayesian prior mean. */
export const scoreMatch = (gig: ScoredGig, profile: ScoredProfile, platformRating = DEFAULT_PLATFORM_RATING): MatchResult => {
  const reasons: string[] = [];

  const similarity = embeddingService.similarity(gig, profile);
  if (similarity.matched.length) reasons.push(`Matches ${similarity.matched.length}/${gig.skills.length} required skills`);
  if (similarity.source === 'ai' && similarity.value >= 0.6) reasons.push('Strong semantic fit with the gig description');

  const n = profile.totalReviews ?? 0;
  const bayesian = (n * (profile.averageRating ?? 0) + BAYES_PRIOR_REVIEWS * platformRating) / (n + BAYES_PRIOR_REVIEWS);
  const rating = Math.min(1, bayesian / 5);
  if (n > 0) reasons.push(`Rated ${profile.averageRating.toFixed(1)}/5 from ${n} review${n === 1 ? '' : 's'}`);

  let proximity = 1;
  let distance: number | undefined;
  if (hasPoint(gig.location) && hasPoint(profile.location)) distance = distanceKm(gig.location, profile.location);
  if (gig.locationType !== 'remote') {
    proximity = distance === undefined ? 0 : 1 - Math.min(distance, MAX_DISTANCE_KM) / MAX_DISTANCE_KM;
    if (distance !== undefined && distance <= MAX_DISTANCE_KM) reasons.push(`${Math.round(distance)} km away`);
  }

  const relevant = (profile.skills ?? []).filter((s) => similarity.matched.some((m) => m.toLowerCase() === s.name.toLowerCase()));
  const pool = relevant.length ? relevant : profile.skills ?? [];
  const avgProficiency = pool.length ? pool.reduce((sum, s) => sum + (PROFICIENCY_VALUE[s.proficiency] ?? 1), 0) / pool.length : 0;
  const experience = Math.min(1, avgProficiency / (REQUIRED_PROFICIENCY[gig.experienceLevel] ?? 1));
  if (experience >= 1) reasons.push('Meets the experience level');

  const price =
    gig.budgetType === 'hourly'
      ? profile.hourlyRate || undefined
      : (profile.milestonePricing ?? []).reduce<number | undefined>((min, p) => (min === undefined ? p.price : Math.min(min, p.price)), undefined);
  const budget =
    price === undefined || !gig.budgetMax ? 0.5 : price <= gig.budgetMax ? 1 : Math.max(0, 1 - (price - gig.budgetMax) / gig.budgetMax);
  if (price !== undefined && budget === 1) reasons.push(gig.budgetType === 'hourly' ? 'Hourly rate within budget' : 'Packages within budget');

  const availability = profile.availability === AvailabilityStatus.AVAILABLE ? 1 : profile.availability === AvailabilityStatus.BUSY ? 0.5 : 0;
  if (availability === 1) reasons.push('Available now');

  const breakdown: MatchBreakdown = {
    skill: round(similarity.value),
    rating: round(rating),
    proximity: round(proximity),
    experience: round(experience),
    budget: round(budget),
    availability,
  };
  let total = (Object.keys(MATCH_WEIGHTS) as (keyof MatchBreakdown)[]).reduce((sum, k) => sum + MATCH_WEIGHTS[k] * breakdown[k], 0);
  if (profile.verification?.status === 'verified') {
    total = Math.min(1, total + VERIFIED_BONUS);
    reasons.push('Verified freelancer');
  }

  return {
    score: round(total * 100, 1),
    breakdown,
    matchedSkills: similarity.matched,
    ...(distance !== undefined && { distanceKm: round(distance, 1) }),
    reasons,
    source: similarity.source,
  };
};

/** Users that may appear in recommendations: active, not banned and (when required) email-verified. */
const eligibleUserFilter = () => ({
  isActive: true,
  isBanned: false,
  ...(env.REQUIRE_EMAIL_VERIFICATION && { isVerified: true }),
});

const PROFILE_FIELDS =
  'user title headline skills averageRating totalReviews completedGigs hourlyRate availability location milestonePricing verification +embedding';

class AIMatchingService {
  private client: InferenceClient | null = null;

  /** Mean rating across freelancers with reviews; the prior for the Bayesian rating. */
  async platformRating(): Promise<number> {
    const [row] = await FreelancerProfile.aggregate<{ mean: number }>([
      { $match: { totalReviews: { $gt: 0 } } },
      { $group: { _id: null, mean: { $avg: '$averageRating' } } },
    ]);
    return row?.mean || DEFAULT_PLATFORM_RATING;
  }

  /**
   * Top freelancers for a gig. Candidates are profiles sharing a skill with the gig plus, for
   * onsite/hybrid gigs with a location, profiles within MAX_DISTANCE_KM ($nearSphere).
   */
  async matchFreelancersToGig(gigId: Types.ObjectId | string, limit = 10) {
    const gig = await Gig.findById(gigId).select('+embedding').lean();
    if (!gig) return [];

    const base = { availability: { $ne: AvailabilityStatus.UNAVAILABLE }, user: { $ne: gig.client } };
    const [bySkill, nearby] = await Promise.all([
      FreelancerProfile.find({ ...base, 'skills.name': { $in: gig.skills.map((s) => containsRegex(s)) } })
        .select(PROFILE_FIELDS)
        .limit(300)
        .lean(),
      gig.locationType !== 'remote' && hasPoint(gig.location)
        ? FreelancerProfile.find({
            ...base,
            location: { $nearSphere: { $geometry: gig.location, $maxDistance: MAX_DISTANCE_KM * 1000 } },
          })
            .select(PROFILE_FIELDS)
            .limit(100)
            .lean()
        : Promise.resolve([]),
    ]);

    const candidates = new Map<string, (typeof bySkill)[number]>();
    for (const p of [...bySkill, ...nearby]) candidates.set(p.user.toString(), p);
    if (!candidates.size) return [];

    const [users, platformRating] = await Promise.all([
      User.find({ _id: { $in: [...candidates.keys()] }, ...eligibleUserFilter() })
        .select('firstName lastName avatar address isVerified')
        .lean(),
      this.platformRating(),
    ]);

    return users
      .map((user) => {
        const { embedding: _embedding, ...profile } = candidates.get(user._id.toString())!;
        return {
          freelancerId: user,
          profile,
          ...scoreMatch(gig, candidates.get(user._id.toString())!, platformRating),
        };
      })
      .filter((m) => m.breakdown.skill > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /** Open gigs ranked for a freelancer (public gigs plus invite-only gigs they were invited to). */
  async recommendGigsForFreelancer(userId: Types.ObjectId | string, limit = 10) {
    const profile = await FreelancerProfile.findOne({ user: userId }).select(PROFILE_FIELDS).lean();
    if (!profile) return [];

    const applied = await Proposal.find({ freelancer: userId }).distinct('gig');
    const [gigs, platformRating] = await Promise.all([
      Gig.find({
        status: GigStatus.OPEN,
        _id: { $nin: applied },
        $or: [{ visibility: 'public' }, { visibility: 'invite_only', 'invitations.freelancer': userId }],
      })
        .select('+embedding')
        .populate('client', 'firstName lastName avatar')
        .sort({ createdAt: -1 })
        .limit(300)
        .lean(),
      this.platformRating(),
    ]);

    return gigs
      .map(({ embedding, ...gig }) => ({ gig, ...scoreMatch({ ...gig, embedding }, profile, platformRating) }))
      .filter((r) => r.breakdown.skill > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async analyzeCareerFromResume(resumeText: string): Promise<CareerReport> {
    try {
      if (!env.HF_ACCESS_TOKEN) throw new Error('HF_ACCESS_TOKEN not set');
      this.client ??= new InferenceClient(env.HF_ACCESS_TOKEN);
      const client = this.client;
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
        model: CAREER_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 600,
        temperature: 0.4,
      });

      const text = result.choices[0].message.content || '';
      
      // Attempt to parse JSON safely
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Omit<CareerReport, 'source'>;
        return { ...parsed, source: 'ai' };
      }
      
      throw new Error('Failed to parse AI response into JSON');
    } catch (error) {
      if (env.HF_ACCESS_TOKEN) console.error('Career Coach AI Error:', (error as Error).message);
      
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
        summary: summary,
        source: 'fallback',
      };
    }
  }
}

export default new AIMatchingService();
