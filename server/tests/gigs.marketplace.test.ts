import request from 'supertest';
import app from '../src/app';
import { features } from '../src/config/env';
import FreelancerProfile from '../src/models/FreelancerProfile';
import Gig from '../src/models/Gig';
import Notification from '../src/models/Notification';
import User from '../src/models/User';
import emailService from '../src/services/emailService';
import uploadService from '../src/services/uploadService';
import { GigStatus, NotificationType, ProficiencyLevel, UserRole } from '../src/types';
import { createGig, createUser } from './helpers';

const gigBody = {
  title: 'Mobile app MVP',
  description: 'Build an MVP',
  category: 'Mobile',
  skills: ['React Native'],
  budgetType: 'fixed',
  budgetMin: 20000,
  budgetMax: 50000,
  duration: '1 month',
  experienceLevel: 'intermediate',
};
const milestone = (amount: number) => ({ title: `M ${amount}`, description: 'x', amount, dueDate: new Date(Date.now() + 864e5).toISOString() });

afterEach(() => jest.restoreAllMocks());

describe('milestones fit the budget (4.4)', () => {
  it('rejects milestones that add up to more than budgetMax', async () => {
    const c = await createUser(UserRole.CLIENT);
    const over = await request(app).post('/api/v1/gigs').set(c.auth).send({ ...gigBody, milestones: [milestone(30000), milestone(25000)] });
    expect(over.status).toBe(400);
    expect(over.body.message).toMatch(/more than the ₹50000 budget/);

    const ok = await request(app).post('/api/v1/gigs').set(c.auth).send({ ...gigBody, milestones: [milestone(30000), milestone(20000)] }).expect(201);
    const shrink = await request(app).put(`/api/v1/gigs/${ok.body.data._id}`).set(c.auth).send({ budgetMax: 40000 });
    expect(shrink.status).toBe(400);
  });
});

describe('gig attachments (4.4)', () => {
  it('answers 503 without Cloudinary', async () => {
    const c = await createUser(UserRole.CLIENT);
    const gig = await createGig(c.user._id);
    const res = await request(app).post(`/api/v1/gigs/${gig._id}/attachments`).set(c.auth).attach('files', Buffer.from('%PDF-1.4'), 'brief.pdf');
    expect(res.status).toBe(503);
  });

  it('stores structured attachments for the owner and deletes them', async () => {
    features.cloudinary = true;
    try {
      jest.spyOn(uploadService, 'uploadFile').mockImplementation(async (file) => ({
        url: `https://cdn.test/${file.originalname}`,
        publicId: `p/${file.originalname}`,
        name: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
        resourceType: 'raw',
      }));
      const remove = jest.spyOn(uploadService, 'deleteFile').mockResolvedValue();
      const c = await createUser(UserRole.CLIENT);
      const other = await createUser(UserRole.CLIENT);
      const gig = await createGig(c.user._id);

      const res = await request(app)
        .post(`/api/v1/gigs/${gig._id}/attachments`)
        .set(c.auth)
        .attach('files', Buffer.from('%PDF-1.4'), { filename: 'brief.pdf', contentType: 'application/pdf' })
        .attach('files', Buffer.from('hello'), { filename: 'notes.txt', contentType: 'text/plain' })
        .expect(201);
      expect(res.body.data.attachments.map((a: { name: string }) => a.name)).toEqual(['brief.pdf', 'notes.txt']);
      expect(res.body.data.attachments[0]).toMatchObject({ url: 'https://cdn.test/brief.pdf', mimeType: 'application/pdf' });

      await request(app).post(`/api/v1/gigs/${gig._id}/attachments`).set(other.auth).attach('files', Buffer.from('x'), 'a.pdf').expect(403);
      const exe = await request(app).post(`/api/v1/gigs/${gig._id}/attachments`).set(c.auth).attach('files', Buffer.from('MZ'), 'virus.exe');
      expect(exe.status).toBe(400);

      const id = res.body.data.attachments[0]._id;
      const del = await request(app).delete(`/api/v1/gigs/${gig._id}/attachments/${id}`).set(c.auth).expect(200);
      expect(del.body.data.attachments).toHaveLength(1);
      expect(remove).toHaveBeenCalledWith('p/brief.pdf', 'raw');
    } finally {
      features.cloudinary = false;
    }
  });
});

describe('invitations (4.4)', () => {
  it('invites a freelancer by notification + email, once, and only on open gigs', async () => {
    const email = jest.spyOn(emailService, 'sendNotificationEmail').mockResolvedValue();
    const c = await createUser(UserRole.CLIENT);
    const f = await createUser(UserRole.FREELANCER);
    const gig = await createGig(c.user._id);

    const res = await request(app).post(`/api/v1/gigs/${gig._id}/invite`).set(c.auth).send({ freelancerId: f.user._id, message: 'You would be great' }).expect(200);
    expect(res.body.data).toHaveLength(1);
    const note = await Notification.findOne({ recipient: f.user._id, type: NotificationType.GIG_INVITATION });
    expect(note?.message).toMatch(/You would be great/);
    expect(email).toHaveBeenCalledTimes(1);

    await request(app).post(`/api/v1/gigs/${gig._id}/invite`).set(c.auth).send({ freelancerId: f.user._id }).expect(409);
    const pending = await createGig(c.user._id, { status: GigStatus.PENDING_APPROVAL });
    await request(app).post(`/api/v1/gigs/${pending._id}/invite`).set(c.auth).send({ freelancerId: f.user._id }).expect(409);
    await request(app).post(`/api/v1/gigs/${gig._id}/invite`).set(c.auth).send({ freelancerId: c.user._id }).expect(404);
  });

  it('respects notification preferences', async () => {
    const email = jest.spyOn(emailService, 'sendNotificationEmail').mockResolvedValue();
    const c = await createUser(UserRole.CLIENT);
    const f = await createUser(UserRole.FREELANCER, {
      notificationPreferences: { email: { gigs: false }, inApp: { gigs: false } },
    });
    const gig = await createGig(c.user._id);
    await request(app).post(`/api/v1/gigs/${gig._id}/invite`).set(c.auth).send({ freelancerId: f.user._id }).expect(200);
    expect(email).not.toHaveBeenCalled();
    expect(await Notification.countDocuments({ recipient: f.user._id })).toBe(0);
  });

  it('shows invite-only gigs to invitees only, who can apply or decline', async () => {
    jest.spyOn(emailService, 'sendNotificationEmail').mockResolvedValue();
    const c = await createUser(UserRole.CLIENT);
    const invitee = await createUser(UserRole.FREELANCER);
    const outsider = await createUser(UserRole.FREELANCER);
    const decliner = await createUser(UserRole.FREELANCER);
    const gig = await createGig(c.user._id, { visibility: 'invite_only' });
    for (const f of [invitee, decliner]) {
      await request(app).post(`/api/v1/gigs/${gig._id}/invite`).set(c.auth).send({ freelancerId: f.user._id }).expect(200);
    }

    await request(app).get(`/api/v1/gigs/${gig._id}`).set(outsider.auth).expect(404);
    const seen = await request(app).get(`/api/v1/gigs/${gig._id}`).set(invitee.auth).expect(200);
    expect(seen.body.data.invitations).toHaveLength(1); // only their own
    const owner = await request(app).get(`/api/v1/gigs/${gig._id}`).set(c.auth).expect(200);
    expect(owner.body.data.invitations).toHaveLength(2);
    const listing = await request(app).get('/api/v1/gigs').expect(200);
    expect(listing.body.data).toHaveLength(0);

    const apply = { gigId: gig._id, coverLetter: 'I can do it', proposedAmount: 6000, estimatedDuration: '2 weeks' };
    await request(app).post('/api/v1/proposals').set(outsider.auth).send(apply).expect(404);
    await request(app).post('/api/v1/proposals').set(invitee.auth).send(apply).expect(201);

    const mine = await request(app).get('/api/v1/gigs/invitations').set(decliner.auth).expect(200);
    expect(mine.body.data[0].invitation.status).toBe('pending');
    await request(app).put(`/api/v1/gigs/${gig._id}/invitation`).set(decliner.auth).send({ status: 'declined' }).expect(200);
    await request(app).put(`/api/v1/gigs/${gig._id}/invitation`).set(decliner.auth).send({ status: 'declined' }).expect(404);

    const statuses = Object.fromEntries((await Gig.findById(gig._id))!.invitations.map((i) => [i.freelancer.toString(), i.status]));
    expect(statuses[invitee.user._id.toString()]).toBe('accepted');
    expect(statuses[decliner.user._id.toString()]).toBe('declined');
  });
});

describe('new matching gig notifications (4.4 / 4.11)', () => {
  it('notifies matching freelancers when an admin approves a public gig', async () => {
    const email = jest.spyOn(emailService, 'sendNotificationEmail').mockResolvedValue();
    const admin = await createUser(UserRole.ADMIN);
    const c = await createUser(UserRole.CLIENT);
    const match = await createUser(UserRole.FREELANCER);
    const other = await createUser(UserRole.FREELANCER);
    await FreelancerProfile.updateOne({ user: match.user._id }, { $set: { skills: [{ name: 'React Native', proficiency: ProficiencyLevel.ADVANCED }] } });
    await FreelancerProfile.updateOne({ user: other.user._id }, { $set: { skills: [{ name: 'Accounting', proficiency: ProficiencyLevel.EXPERT }] } });
    const gig = await createGig(c.user._id, { skills: ['React Native'], status: GigStatus.PENDING_APPROVAL });

    await request(app).put(`/api/v1/admin/gigs/${gig._id}/approve`).set(admin.auth).expect(200);
    expect(await Notification.countDocuments({ recipient: match.user._id, type: NotificationType.GIG_MATCH })).toBe(1);
    expect(await Notification.countDocuments({ recipient: other.user._id, type: NotificationType.GIG_MATCH })).toBe(0);
    expect(email).toHaveBeenCalledWith(expect.objectContaining({ email: match.user.email }), expect.any(String), expect.stringMatching(/% match/), `/gigs/${gig._id}`);
    expect(await User.countDocuments()).toBe(4);
  });
});
