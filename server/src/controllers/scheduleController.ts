import { Response, NextFunction } from 'express';
import Booking from '../models/Booking';
import FreelancerProfile from '../models/FreelancerProfile';
import scheduleService, { SLOT_MINUTES } from '../services/scheduleService';
import { AuthRequest, BookingStatus, UserRole } from '../types';
import { HttpError } from '../utils/httpError';

const DAY_MS = 86_400_000;
const dateParam = (value: unknown, fallback: Date): Date => {
  if (typeof value !== 'string' || !value) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new HttpError(400, `Invalid date: ${value}`);
  return d;
};

/** GET /schedule/:freelancerId/availability?from=&to= — free 30-minute slots (default: next 14 days). */
export const getAvailability = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const from = dateParam(req.query.from, new Date());
    const to = dateParam(req.query.to, new Date(from.getTime() + 14 * DAY_MS));
    const { timezone, slots } = await scheduleService.freeSlots(String(req.params.freelancerId), from, to);
    res.status(200).json({ success: true, message: 'Availability', data: { timezone, slotMinutes: SLOT_MINUTES, slots } });
  } catch (error) {
    next(error);
  }
};

/** PUT /schedule/me/slots { availabilitySlots, timezone?, autoConfirmBookings? } — freelancer's weekly template. */
export const updateMySlots = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { availabilitySlots, timezone, autoConfirmBookings } = req.body as {
      availabilitySlots: { dayOfWeek: number; startTime: string; endTime: string }[];
      timezone?: string;
      autoConfirmBookings?: boolean;
    };
    const profile = await FreelancerProfile.findOneAndUpdate(
      { user: req.user!._id },
      { $set: { availabilitySlots, ...(timezone && { timezone }), ...(autoConfirmBookings !== undefined && { autoConfirmBookings }) } },
      { returnDocument: 'after', runValidators: true }
    ).select('availabilitySlots timezone autoConfirmBookings');
    res.status(200).json({ success: true, message: 'Availability saved', data: profile });
  } catch (error) {
    next(error);
  }
};

/** POST /schedule/bookings { freelancerId, start, durationMinutes, title, notes?, gigId? } — client books a slot. */
export const createBooking = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { start, ...rest } = req.body as { freelancerId: string; start: string; durationMinutes: number; title: string; notes?: string; gigId?: string };
    const booking = await scheduleService.book(req.user!, { ...rest, start: new Date(start) });
    res.status(201).json({ success: true, message: booking.status === 'confirmed' ? 'Meeting booked' : 'Meeting requested', data: booking });
  } catch (error) {
    next(error);
  }
};

/** GET /schedule/bookings?from=&to=&status= — my bookings (as freelancer or client). */
export const getBookings = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const me = req.user!;
    const filter: Record<string, unknown> = me.role === UserRole.FREELANCER ? { freelancer: me._id } : { client: me._id };
    const from = dateParam(req.query.from, new Date(Date.now() - 7 * DAY_MS));
    const to = dateParam(req.query.to, new Date(Date.now() + 60 * DAY_MS));
    filter.start = { $gte: from, $lt: to };
    const statuses = typeof req.query.status === 'string' ? (req.query.status.split(',') as BookingStatus[]) : null;
    if (statuses) filter.status = { $in: statuses };
    const bookings = await Booking.find(filter)
      .populate('freelancer', 'firstName lastName avatar')
      .populate('client', 'firstName lastName avatar')
      .populate('gig', 'title')
      .sort({ start: 1 })
      .limit(500)
      .lean();
    res.status(200).json({ success: true, message: 'Bookings', data: bookings });
  } catch (error) {
    next(error);
  }
};

/** PUT /schedule/bookings/:id { status?, meetingLink? } */
export const updateBooking = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) throw new HttpError(404, 'Booking not found');
    const updated = await scheduleService.update(booking, req.user!, req.body);
    res.status(200).json({ success: true, message: 'Booking updated', data: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /schedule/auto-schedule { freelancerId, durationMinutes, earliest?, latest?, book?, title?, notes? }
 * — the earliest slot free for both sides; with `book: true` it is booked straight away.
 */
export const autoSchedule = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { freelancerId, durationMinutes, book, title, notes } = req.body as {
      freelancerId: string;
      durationMinutes: number;
      book?: boolean;
      title?: string;
      notes?: string;
    };
    const earliest = dateParam(req.body.earliest, new Date());
    const latest = dateParam(req.body.latest, new Date(earliest.getTime() + 30 * DAY_MS));
    const slot = await scheduleService.findNextAvailable(freelancerId, req.user!._id, durationMinutes, earliest, latest);
    if (!slot) {
      res.status(404).json({ success: false, message: 'No common free time in that window' });
      return;
    }
    if (!book) {
      res.status(200).json({ success: true, message: 'Next available slot', data: { slot } });
      return;
    }
    const booking = await scheduleService.book(req.user!, { freelancerId, start: slot.start, durationMinutes, title: title || 'Meeting', notes });
    res.status(201).json({ success: true, message: 'Meeting booked', data: { slot, booking } });
  } catch (error) {
    next(error);
  }
};
