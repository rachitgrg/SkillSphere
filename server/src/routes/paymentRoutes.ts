import { Router, Request, Response, NextFunction } from 'express';
import {
  createOrder,
  verifyPayment,
  releasePayment,
  refundPayment,
  getPayments,
  getPaymentSummary,
  getPaymentConfig,
  simulatePayment,
  exportPayments,
} from '../controllers/paymentController';
import { protect } from '../middleware/auth';
import { authorize, requireVerified } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { createPaymentSchema, verifyPaymentSchema, refundPaymentSchema } from '../utils/validators';
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

router.get('/', getPayments);
router.get('/summary', getPaymentSummary);
router.get('/export', exportPayments);
router.get('/config', getPaymentConfig);
router.post('/orders', authorize(UserRole.CLIENT), requirePayments, requireVerified, validate(createPaymentSchema), createOrder);
router.post('/verify', authorize(UserRole.CLIENT), requirePayments, validate(verifyPaymentSchema), verifyPayment);
router.post('/:id/simulate', authorize(UserRole.CLIENT), simulatePayment);
router.post('/:id/release', authorize(UserRole.CLIENT), releasePayment);
router.post('/:id/refund', authorize(UserRole.CLIENT), requirePayments, validate(refundPaymentSchema), refundPayment);

export default router;
