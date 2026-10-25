import { Router } from 'express';
import { createReview, getReviews, replyToReview } from '../controllers/reviewController';
import { protect } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createReviewSchema, respondReviewSchema } from '../utils/validators';

const router = Router();

router.use(protect);

router.post('/', validate(createReviewSchema), createReview);
router.get('/user/:userId', getReviews);
router.post('/:id/reply', validate(respondReviewSchema), replyToReview);

export default router;
