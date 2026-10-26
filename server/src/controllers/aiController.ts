import { Response, NextFunction } from 'express';
import Gig from '../models/Gig';
import aiMatchingService from '../services/aiMatchingService';
import { AuthRequest } from '../types';

/** GET /ai/gigs/:gigId/matches — ranked freelancers (score 0–100 with breakdown) for the client's own gig. */
export const getGigMatches = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const gig = await Gig.findById(req.params.gigId).select('client').lean();
    if (!gig || gig.client.toString() !== req.user!._id.toString()) {
      res.status(404).json({ success: false, message: 'Gig not found' });
      return;
    }

    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const matches = await aiMatchingService.matchFreelancersToGig(gig._id, limit);
    res.status(200).json({ success: true, message: 'Matches generated', data: matches });
  } catch (error) {
    next(error);
  }
};

/** GET /ai/recommendations — open gigs ranked for the signed-in freelancer with the same weighted score. */
export const getRecommendations = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const ranked = await aiMatchingService.recommendGigsForFreelancer(req.user!._id, limit);
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
