import { Types } from 'mongoose';
import Booking from '../models/Booking';
import FreelancerProfile from '../models/FreelancerProfile';
import User from '../models/User';
import notificationService from './notificationService';
import { BookingStatus, IBooking, NotificationType, UserRole } from '../types';
import { HttpError } from '../utils/httpError';
import { withLock } from '../utils/lock';
import { zonedDay, zonedToUtc } from '../utils/timezone';

/** Availability granularity. Bookings start on a slot boundary and last whole slots. */
export const SLOT_MINUTES = 30;
const SLOT_MS = SLOT_MINUTES * 60_000;
const DAY_MS = 86_400_000;
const MAX_RANGE_DAYS = 31;
const ACTIVE: BookingStatus[] = ['pending', 'confirmed'];

export interface Slot {
  start: Date;
  end: Date;
}

const overlaps = (a: Slot, b: Slot) => a.start < b.end && b.start < a.end;

const formatWhen = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-IN', { timeZone, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(date);

class ScheduleService {
  private async profile(freelancerId: string | Types.ObjectId) {
    const user = await User.findOne({ _id: freelancerId, role: UserRole.FREELANCER, isActive: true, isBanned: false }).select('_id');
    const profile = user && (await FreelancerProfile.findOne({ user: user._id }).select('availabilitySlots timezone autoConfirmBookings'));
    if (!profile) throw new HttpError(404, 'Freelancer not found');
    return profile;
  }

  /**
   * Free 30-minute slots in [from, to): the weekly template (in the freelancer's time zone) minus
   * pending/confirmed bookings and anything in the past.
   */
  async freeSlots(freelancerId: string | Types.ObjectId, from: Date, to: Date): Promise<{ timezone: string; slots: Slot[] }> {
    if (!(from < to)) throw new HttpError(400, '`from` must be before `to`');
    if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * DAY_MS) throw new HttpError(400, `Ask for at most ${MAX_RANGE_DAYS} days at a time`);
    const profile = await this.profile(freelancerId);
    const tz = profile.timezone || 'Asia/Kolkata';
    const now = Date.now();

    const busy = await Booking.find({ freelancer: freelancerId, status: { $in: ACTIVE }, start: { $lt: to }, end: { $gt: from } })
      .select('start end')
      .lean();

    const slots: Slot[] = [];
    // Walk local calendar days covering the range (one extra day on each side for zone offsets).
    for (let t = from.getTime() - DAY_MS; t < to.getTime() + DAY_MS; t += DAY_MS) {
      const { date, weekday } = zonedDay(new Date(t), tz);
      for (const window of profile.availabilitySlots.filter((s) => s.dayOfWeek === weekday)) {
        const windowStart = zonedToUtc(date, window.startTime, tz).getTime();
        const windowEnd = zonedToUtc(date, window.endTime, tz).getTime();
        for (let s = windowStart; s + SLOT_MS <= windowEnd; s += SLOT_MS) {
          const slot = { start: new Date(s), end: new Date(s + SLOT_MS) };
          if (s < now || slot.start < from || slot.end > to) continue;
          if (busy.some((b) => overlaps(slot, b))) continue;
          slots.push(slot);
        }
      }
    }
    // Days visited twice (range edges) can repeat slots; dedupe and sort.
    const unique = new Map(slots.map((s) => [s.start.getTime(), s]));
    return { timezone: tz, slots: [...unique.values()].sort((a, b) => a.start.getTime() - b.start.getTime()) };
  }

  /** First run of consecutive free slots of `minutes` in the list, optionally skipping `blocked` intervals. */
  private firstRun(slots: Slot[], minutes: number, blocked: Slot[] = []): Slot | null {
    const needed = Math.ceil(minutes / SLOT_MINUTES);
    for (let i = 0; i + needed <= slots.length; i += 1) {
      const run = slots.slice(i, i + needed);
      const contiguous = run.every((s, k) => k === 0 || s.start.getTime() === run[k - 1].end.getTime());
      const candidate = { start: run[0].start, end: run[run.length - 1].end };
      if (contiguous && !blocked.some((b) => overlaps(candidate, b))) return candidate;
    }
    return null;
  }

  private async clientBusy(clientId: string | Types.ObjectId, from: Date, to: Date) {
    return Booking.find({ client: clientId, status: { $in: ACTIVE }, start: { $lt: to }, end: { $gt: from } }).select('start end').lean();
  }

  /**
   * Books `start`..`start + durationMinutes` with a freelancer. The conflict check and insert run under
   * a per-freelancer lock so two clients can't take the same slot. Auto-confirms when enabled.
   */
  async book(
    client: { _id: Types.ObjectId; firstName: string; lastName: string },
    input: { freelancerId: string; start: Date; durationMinutes: number; title: string; notes?: string; gigId?: string }
  ): Promise<IBooking> {
    if (input.freelancerId === client._id.toString()) throw new HttpError(400, 'You cannot book yourself');
    if (input.start.getTime() % SLOT_MS !== 0) throw new HttpError(400, `Bookings start on a ${SLOT_MINUTES}-minute boundary`);
    const end = new Date(input.start.getTime() + input.durationMinutes * 60_000);

    const { booking, timezone } = await withLock(`booking:${input.freelancerId}`, async () => {
      const { slots, timezone } = await this.freeSlots(input.freelancerId, input.start, end);
      if (!this.firstRun(slots, input.durationMinutes) || slots[0]?.start.getTime() !== input.start.getTime()) {
        throw new HttpError(409, 'That time is no longer available');
      }
      if ((await this.clientBusy(client._id, input.start, end)).length) throw new HttpError(409, 'You already have a booking at that time');
      const profile = await this.profile(input.freelancerId);
      const created = await Booking.create({
        freelancer: input.freelancerId,
        client: client._id,
        gig: input.gigId,
        start: input.start,
        end,
        title: input.title,
        notes: input.notes,
        status: profile.autoConfirmBookings ? 'confirmed' : 'pending',
      });
      return { booking: created, timezone };
    });

    const when = formatWhen(booking.start, timezone);
    await notificationService.create({
      recipient: input.freelancerId,
      sender: client._id.toString(),
      type: NotificationType.BOOKING_UPDATE,
      title: booking.status === 'confirmed' ? 'New meeting booked' : 'Meeting request',
      message: `${client.firstName} ${client.lastName} ${booking.status === 'confirmed' ? 'booked' : 'requested'} "${booking.title}" on ${when}.`,
      data: { bookingId: booking._id.toString() },
      link: '/freelancer/schedule',
      category: 'projects',
    });
    return booking;
  }

  /**
   * Earliest slot of `durationMinutes` between `earliest` and `latest` that is free for the freelancer
   * and doesn't clash with the client's own bookings (searched in 31-day windows, up to 90 days).
   */
  async findNextAvailable(freelancerId: string, clientId: Types.ObjectId, durationMinutes: number, earliest: Date, latest: Date): Promise<Slot | null> {
    const end = Math.min(latest.getTime(), earliest.getTime() + 90 * DAY_MS);
    for (let from = Math.max(earliest.getTime(), Date.now()); from < end; from += MAX_RANGE_DAYS * DAY_MS) {
      const to = new Date(Math.min(from + MAX_RANGE_DAYS * DAY_MS, end));
      const { slots } = await this.freeSlots(freelancerId, new Date(from), to);
      const run = this.firstRun(slots, durationMinutes, await this.clientBusy(clientId, new Date(from), to));
      if (run) return run;
    }
    return null;
  }

  /**
   * Status changes: the freelancer confirms, declines (cancelled) or completes; the client can cancel.
   * The other party is notified.
   */
  async update(
    booking: IBooking,
    actor: { _id: Types.ObjectId; firstName: string; lastName: string },
    change: { status?: BookingStatus; meetingLink?: string }
  ): Promise<IBooking> {
    const isFreelancer = booking.freelancer.equals(actor._id);
    const isClient = booking.client.equals(actor._id);
    if (!isFreelancer && !isClient) throw new HttpError(404, 'Booking not found');

    if (change.status && change.status !== booking.status) {
      const allowed: Record<string, BookingStatus[]> = isFreelancer
        ? { pending: ['confirmed', 'cancelled'], confirmed: ['cancelled', 'completed'] }
        : { pending: ['cancelled'], confirmed: ['cancelled'] };
      if (!allowed[booking.status]?.includes(change.status)) throw new HttpError(409, `Cannot change a ${booking.status} booking to ${change.status}`);
      if (change.status === 'completed' && booking.end.getTime() > Date.now()) throw new HttpError(409, 'A meeting can be completed once it has ended');
      booking.status = change.status;
      if (change.status === 'cancelled') booking.cancelledBy = actor._id;
    }
    if (change.meetingLink !== undefined) {
      if (!isFreelancer) throw new HttpError(403, 'Only the freelancer sets the meeting link');
      booking.meetingLink = change.meetingLink || undefined;
    }
    await booking.save();

    const profile = await FreelancerProfile.findOne({ user: booking.freelancer }).select('timezone').lean();
    const when = formatWhen(booking.start, profile?.timezone || 'Asia/Kolkata');
    const verb = { confirmed: 'confirmed', cancelled: isFreelancer ? 'declined' : 'cancelled', completed: 'marked as done', pending: 'updated' }[booking.status];
    await notificationService.create({
      recipient: (isFreelancer ? booking.client : booking.freelancer).toString(),
      sender: actor._id.toString(),
      type: NotificationType.BOOKING_UPDATE,
      title: `Meeting ${verb}`,
      message: `${actor.firstName} ${actor.lastName} ${verb} "${booking.title}" on ${when}${booking.meetingLink && booking.status === 'confirmed' ? ` — join: ${booking.meetingLink}` : ''}.`,
      data: { bookingId: booking._id.toString() },
      link: isFreelancer ? '/bookings' : '/freelancer/schedule',
      category: 'projects',
    });
    return booking;
  }
}

export default new ScheduleService();
