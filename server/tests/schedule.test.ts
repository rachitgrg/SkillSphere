import request from 'supertest';
import app from '../src/app';
import Booking from '../src/models/Booking';
import FreelancerProfile from '../src/models/FreelancerProfile';
import Notification from '../src/models/Notification';
import { NotificationType, UserRole } from '../src/types';
import { zonedToUtc, zoneOffsetMinutes } from '../src/utils/timezone';
import { createUser } from './helpers';

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, startTime: '10:00', endTime: '12:00' }));

/** A date (YYYY-MM-DD) `days` from today, safely in the future. */
const dayFromNow = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const ist = (date: string, time: string) => zonedToUtc(date, time, 'Asia/Kolkata');

const setup = async (profile: Record<string, unknown> = {}) => {
  const freelancer = await createUser(UserRole.FREELANCER);
  const client = await createUser(UserRole.CLIENT);
  const other = await createUser(UserRole.CLIENT);
  await FreelancerProfile.updateOne({ user: freelancer.user._id }, { $set: { availabilitySlots: EVERY_DAY, timezone: 'Asia/Kolkata', ...profile } });
  return { freelancer, client, other };
};

const book = (auth: Record<string, string>, freelancerId: string, start: Date, durationMinutes = 60) =>
  request(app).post('/api/v1/schedule/bookings').set(auth).send({ freelancerId, start: start.toISOString(), durationMinutes, title: 'Project kick-off' });

describe('time zones', () => {
  it('converts wall-clock times in a zone to UTC', () => {
    expect(zonedToUtc('2030-01-07', '10:00', 'Asia/Kolkata').toISOString()).toBe('2030-01-07T04:30:00.000Z');
    expect(zoneOffsetMinutes(new Date('2030-01-07T00:00:00Z'), 'Asia/Kolkata')).toBe(330);
    expect(zonedToUtc('2030-07-01', '09:00', 'America/New_York').toISOString()).toBe('2030-07-01T13:00:00.000Z'); // EDT
  });
});

describe('availability & bookings (4.12)', () => {
  it('lists free 30-minute slots from the weekly template minus bookings', async () => {
    const { freelancer, client } = await setup();
    const date = dayFromNow(3);
    const from = ist(date, '00:00').toISOString();
    const to = ist(date, '23:59').toISOString();
    const url = `/api/v1/schedule/${freelancer.user._id}/availability?from=${from}&to=${to}`;

    const before = await request(app).get(url).expect(200);
    expect(before.body.data.timezone).toBe('Asia/Kolkata');
    expect(before.body.data.slots).toHaveLength(4);
    expect(before.body.data.slots[0].start).toBe(ist(date, '10:00').toISOString());

    await book(client.auth, freelancer.user.id, ist(date, '10:30')).expect(201);
    const after = await request(app).get(url).expect(200);
    expect(after.body.data.slots.map((s: { start: string }) => s.start)).toEqual([ist(date, '10:00').toISOString(), ist(date, '11:30').toISOString()]);
  });

  it('rejects overlaps, off-grid starts, times outside the template and double booking races', async () => {
    const { freelancer, client, other } = await setup();
    const date = dayFromNow(4);
    await book(client.auth, freelancer.user.id, ist(date, '10:15')).expect(400);
    await book(client.auth, freelancer.user.id, ist(date, '14:00')).expect(409);
    await book(client.auth, freelancer.user.id, ist(date, '11:30'), 60).expect(409); // runs past 12:00

    const results = await Promise.all([book(client.auth, freelancer.user.id, ist(date, '10:00')), book(other.auth, freelancer.user.id, ist(date, '10:30'))]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await Booking.countDocuments({ freelancer: freelancer.user._id })).toBe(1);
  });

  it('confirms, declines and completes with notifications and role checks', async () => {
    const { freelancer, client, other } = await setup();
    const res = await book(client.auth, freelancer.user.id, ist(dayFromNow(5), '10:00')).expect(201);
    expect(res.body.data.status).toBe('pending');
    expect(await Notification.countDocuments({ recipient: freelancer.user._id, type: NotificationType.BOOKING_UPDATE })).toBe(1);
    const url = `/api/v1/schedule/bookings/${res.body.data._id}`;

    await request(app).put(url).set(other.auth).send({ status: 'cancelled' }).expect(404);
    await request(app).put(url).set(client.auth).send({ status: 'confirmed' }).expect(409);
    await request(app).put(url).set(client.auth).send({ meetingLink: 'https://meet.example/x' }).expect(403);
    const confirmed = await request(app).put(url).set(freelancer.auth).send({ status: 'confirmed', meetingLink: 'https://meet.example/abc' }).expect(200);
    expect(confirmed.body.data).toMatchObject({ status: 'confirmed', meetingLink: 'https://meet.example/abc' });
    await request(app).put(url).set(freelancer.auth).send({ status: 'completed' }).expect(409); // not over yet
    await request(app).put(url).set(client.auth).send({ status: 'cancelled' }).expect(200);
    expect(await Notification.countDocuments({ recipient: client.user._id, type: NotificationType.BOOKING_UPDATE })).toBe(1);

    const mine = await request(app).get('/api/v1/schedule/bookings').set(freelancer.auth).expect(200);
    expect(mine.body.data[0].client.firstName).toBe('Test');
  });

  it('auto-confirms when enabled and keeps weekly slots editable', async () => {
    const { freelancer, client } = await setup({ autoConfirmBookings: true });
    const res = await book(client.auth, freelancer.user.id, ist(dayFromNow(6), '10:00')).expect(201);
    expect(res.body.data.status).toBe('confirmed');

    await request(app).put('/api/v1/schedule/me/slots').set(freelancer.auth).send({ availabilitySlots: [{ dayOfWeek: 1, startTime: '12:00', endTime: '10:00' }] }).expect(400);
    await request(app).put('/api/v1/schedule/me/slots').set(freelancer.auth).send({ availabilitySlots: EVERY_DAY, timezone: 'Mars/Olympus' }).expect(400);
    const saved = await request(app).put('/api/v1/schedule/me/slots').set(freelancer.auth).send({ availabilitySlots: EVERY_DAY.slice(0, 1), timezone: 'Europe/London', autoConfirmBookings: false }).expect(200);
    expect(saved.body.data).toMatchObject({ timezone: 'Europe/London', autoConfirmBookings: false });
  });

  it('auto-schedules the earliest slot free for both sides and can book it', async () => {
    const { freelancer, client } = await setup();
    const date = dayFromNow(2);
    // The client is busy with another freelancer at 10:00–11:00 that day.
    const busyWith = await setup();
    await book(client.auth, busyWith.freelancer.user.id, ist(date, '10:00')).expect(201);

    const earliest = ist(date, '00:00').toISOString();
    const found = await request(app).post('/api/v1/schedule/auto-schedule').set(client.auth).send({ freelancerId: freelancer.user.id, durationMinutes: 60, earliest }).expect(200);
    expect(found.body.data.slot.start).toBe(ist(date, '11:00').toISOString());

    const booked = await request(app)
      .post('/api/v1/schedule/auto-schedule')
      .set(client.auth)
      .send({ freelancerId: freelancer.user.id, durationMinutes: 60, earliest, book: true, title: 'Scope call' })
      .expect(201);
    expect(booked.body.data.booking).toMatchObject({ title: 'Scope call', start: ist(date, '11:00').toISOString() });

    const none = await request(app)
      .post('/api/v1/schedule/auto-schedule')
      .set(client.auth)
      .send({ freelancerId: freelancer.user.id, durationMinutes: 180, earliest });
    expect(none.status).toBe(404);
  });
});
