import { Router } from 'express';
import { createPaymentIntent, verifyPayment, releasePayment, getPayments } from '../controllers/paymentController';
import { protect } from '../middleware/auth';

const router = Router();

router.use(protect);

router.post('/intent', createPaymentIntent);
router.post('/verify', verifyPayment);
router.post('/:id/release', releasePayment);
router.get('/', getPayments);

export default router;
