import { Router } from 'express';
import { getAvailability, updateMySlots, createBooking, getBookings, updateBooking, autoSchedule } from '../controllers/scheduleController';
import { protect, optionalAuth } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { slotsSchema, createBookingSchema, updateBookingSchema, autoScheduleSchema } from '../utils/validators';
import { UserRole } from '../types';

const router = Router();

// Literal paths before `/:freelancerId/...`.
router.put('/me/slots', protect, authorize(UserRole.FREELANCER), validate(slotsSchema), updateMySlots);
router.get('/bookings', protect, getBookings);
router.post('/bookings', protect, authorize(UserRole.CLIENT), validate(createBookingSchema), createBooking);
router.put('/bookings/:id', protect, validate(updateBookingSchema), updateBooking);
router.post('/auto-schedule', protect, authorize(UserRole.CLIENT), validate(autoScheduleSchema), autoSchedule);
router.get('/:freelancerId/availability', optionalAuth, getAvailability);

export default router;
