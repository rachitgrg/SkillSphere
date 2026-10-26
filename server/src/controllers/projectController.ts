import { Response, NextFunction } from 'express';
import Gig from '../models/Gig';
import Payment from '../models/Payment';
import Review from '../models/Review';
import projectService, { computeProgress, Party } from '../services/projectService';
import uploadService from '../services/uploadService';
import { uploadedFiles } from '../middleware/upload';
import { AuthRequest } from '../types';
import { HttpError } from '../utils/httpError';

const param = (req: AuthRequest, name: string) => String(req.params[name]);

/** Loads the project for the caller and checks they play `allowed`. */
const load = async (req: AuthRequest, allowed: Party[]) => {
  const { gig, party } = await projectService.loadForParty(param(req, 'id'), req.user!);
  if (!allowed.includes(party)) throw new HttpError(403, `Only the ${allowed.join(' or ')} can do this`);
  return { gig, party };
};

/** GET /gigs/:id/progress — milestones, completion %, progress logs and payments, for both parties and admins. */
export const getProgress = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { gig, party } = await projectService.loadForParty(param(req, 'id'), req.user!);
    const [populated, payments, reviewed] = await Promise.all([
      Gig.findById(gig._id)
        .populate('client', 'firstName lastName avatar')
        .populate('selectedFreelancer', 'firstName lastName avatar')
        .populate('progressLogs.author', 'firstName lastName avatar')
        .lean(),
      Payment.find({ gig: gig._id }).select('-razorpaySignature').sort({ createdAt: 1 }).lean(),
      Review.exists({ gig: gig._id, reviewer: req.user!._id }),
    ]);
    res.status(200).json({
      success: true,
      message: 'Project progress',
      data: { gig: populated, party, progress: computeProgress(gig.milestones), payments, reviewed: Boolean(reviewed) },
    });
  } catch (error) {
    next(error);
  }
};

/** POST /gigs/:id/progress-logs — message, milestoneId?, `files` (up to 5; multipart). */
export const addProgressLog = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { gig, party } = await load(req, ['client', 'freelancer']);
    const files = await uploadService.uploadFiles(uploadedFiles(req), 'progress');
    const { message, milestoneId } = req.body as { message: string; milestoneId?: string };
    const log = await projectService.addLog(gig, req.user!, party, message, milestoneId || undefined, files);
    res.status(201).json({ success: true, message: 'Update posted', data: log });
  } catch (error) {
    next(error);
  }
};

const milestoneAction =
  (allowed: Party[], run: (req: AuthRequest, gig: Awaited<ReturnType<typeof load>>['gig']) => Promise<unknown>, message: string) =>
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { gig } = await load(req, allowed);
      const result = await run(req, gig);
      res.status(200).json({ success: true, message, data: result });
    } catch (error) {
      next(error);
    }
  };

/** PUT /gigs/:id/milestones/:mid/start — freelancer, milestone must be funded. */
export const startMilestone = milestoneAction(['freelancer'], (req, gig) => projectService.start(gig, param(req, 'mid')), 'Milestone started');

/** PUT /gigs/:id/milestones/:mid/progress { percent } — freelancer's estimate. */
export const setMilestoneProgress = milestoneAction(
  ['freelancer'],
  (req, gig) => projectService.setPercent(gig, param(req, 'mid'), (req.body as { percent: number }).percent),
  'Progress updated'
);

/** PUT /gigs/:id/milestones/:mid/submit — freelancer delivers: note + `files` (multipart). */
export const submitMilestone = milestoneAction(
  ['freelancer'],
  async (req, gig) => {
    const files = await uploadService.uploadFiles(uploadedFiles(req), 'deliveries');
    return projectService.submit(gig, param(req, 'mid'), (req.body as { note?: string }).note, files);
  },
  'Milestone submitted'
);

/** PUT /gigs/:id/milestones/:mid/approve — client; releases the milestone's escrow. */
export const approveMilestone = milestoneAction(['client'], (req, gig) => projectService.approve(gig, param(req, 'mid')), 'Milestone approved');

/** PUT /gigs/:id/milestones/:mid/request-changes { note } — client. */
export const requestMilestoneChanges = milestoneAction(
  ['client'],
  (req, gig) => projectService.requestChanges(gig, param(req, 'mid'), (req.body as { note: string }).note),
  'Changes requested'
);

/** PUT /gigs/:id/complete — client; all milestones approved, releases any remaining escrow. */
export const completeGig = milestoneAction(['client'], (_req, gig) => projectService.complete(gig), 'Project completed');
