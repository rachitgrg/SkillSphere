import { Response, NextFunction } from 'express';
import Gig from '../models/Gig';
import FreelancerProfile from '../models/FreelancerProfile';
import aiMatchingService from '../services/aiMatchingService';
import { AuthRequest, GigStatus } from '../types';

/** GET /ai/gigs/:gigId/matches — ranked freelancers for the client's own gig. */
export const getGigMatches = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const gig = await Gig.findById(req.params.gigId);
    if (!gig || gig.client.toString() !== req.user!._id.toString()) {
      res.status(404).json({ success: false, message: 'Gig not found' });
      return;
    }

    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const matches = await aiMatchingService.matchFreelancersToGig(gig, limit);
    res.status(200).json({ success: true, message: 'Matches generated', data: matches });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /ai/recommendations — open gigs ranked for the signed-in freelancer by skill overlap
 * (replaced by embedding similarity in plan 4.2).
 */
export const getRecommendations = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const profile = await FreelancerProfile.findOne({ user: req.user!._id }).lean();
    const skills = (profile?.skills ?? []).map((s) => s.name.toLowerCase());
    const limit = Math.min(Number(req.query.limit) || 10, 50);

    const gigs = await Gig.find({ status: GigStatus.OPEN, visibility: 'public' })
      .populate('client', 'firstName lastName avatar')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const ranked = gigs
      .map((gig) => {
        const matched = gig.skills.filter((s) => skills.includes(s.toLowerCase()));
        return { gig, score: gig.skills.length ? Math.round((matched.length / gig.skills.length) * 100) : 0, matchedSkills: matched };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    res.status(200).json({ success: true, message: 'Recommendations generated', data: ranked });
  } catch (error) {
    next(error);
  }
};

/** POST /ai/career-analysis — resume text → career report. */
export const careerAnalysis = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const report = await aiMatchingService.analyzeCareerFromResume(req.body.resumeText);
    res.status(200).json({ success: true, message: 'Career analysis complete', data: report });
  } catch (error) {
    next(error);
  }
};
