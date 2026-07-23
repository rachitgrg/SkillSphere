import { Router } from 'express';
import { createReview, getReviews, replyToReview } from '../controllers/reviewController';
import { protect } from '../middleware/auth';

const router = Router();

router.use(protect);

router.post('/', createReview);
router.get('/user/:userId', getReviews);
router.post('/:id/reply', replyToReview);

export default router;
