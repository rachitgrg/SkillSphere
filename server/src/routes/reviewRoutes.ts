import { Router } from 'express';
import { createReview, getReviews, getReviewBreakdown, replyToReview, reportReview } from '../controllers/reviewController';
import { protect, optionalAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createReviewSchema, respondReviewSchema, reportReviewSchema } from '../utils/validators';

const router = Router();

router.post('/', protect, validate(createReviewSchema), createReview);
router.get('/user/:userId', optionalAuth, getReviews);
router.get('/user/:userId/breakdown', optionalAuth, getReviewBreakdown);
router.post('/:id/reply', protect, validate(respondReviewSchema), replyToReview);
router.post('/:id/report', protect, validate(reportReviewSchema), reportReview);

export default router;
