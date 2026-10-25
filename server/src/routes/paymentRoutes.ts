import { Router, Request, Response, NextFunction } from 'express';
import { createOrder, verifyPayment, releasePayment, getPayments } from '../controllers/paymentController';
import { protect } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { createPaymentSchema, verifyPaymentSchema } from '../utils/validators';
import paymentService from '../services/paymentService';
import { UserRole } from '../types';

const router = Router();

/** Routes that move money answer 503 until Razorpay keys are configured. */
const requirePayments = (_req: Request, res: Response, next: NextFunction): void => {
  if (!paymentService.isConfigured()) {
    res.status(503).json({ success: false, message: 'Payments not configured' });
    return;
  }
  next();
};

router.use(protect);

router.post('/orders', requirePayments, authorize(UserRole.CLIENT), validate(createPaymentSchema), createOrder);
router.post('/verify', requirePayments, authorize(UserRole.CLIENT), validate(verifyPaymentSchema), verifyPayment);
router.post('/:id/release', requirePayments, authorize(UserRole.CLIENT), releasePayment);
router.get('/', getPayments);

export default router;
