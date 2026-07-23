import { Router } from 'express';
import { getEarningsAnalytics, getSpendingAnalytics } from '../controllers/analyticsController';
import { protect } from '../middleware/auth';

const router = Router();

router.use(protect);

router.get('/earnings', getEarningsAnalytics);
router.get('/spending', getSpendingAnalytics);

export default router;
