import request from 'supertest';
import { Types } from 'mongoose';
import app from '../src/app';
import ClientProfile from '../src/models/ClientProfile';
import Gig from '../src/models/Gig';
import Payment from '../src/models/Payment';
import Proposal from '../src/models/Proposal';
import uploadService from '../src/services/uploadService';
import { GigStatus, PaymentStatus, ProposalStatus, UserRole } from '../src/types';
import { createGig, createUser } from './helpers';

const addProposal = (gigId: Types.ObjectId, freelancerId: Types.ObjectId) =>
  Proposal.create({ gig: gigId, freelancer: freelancerId, coverLetter: 'Hi', proposedAmount: 5000, estimatedDuration: '1 week' });

describe('DELETE /api/v1/gigs/:id (1.15)', () => {
  it('deletes an open gig and cascades its proposals', async () => {
    const client = await createUser(UserRole.CLIENT);
    const freelancer = await createUser(UserRole.FREELANCER);
    const gig = await createGig(client.user._id);
    await addProposal(gig._id, freelancer.user._id);

    const res = await request(app).delete(`/api/v1/gigs/${gig.id}`).set(client.auth);
    expect(res.status).toBe(200);
    expect(await Gig.exists({ _id: gig._id })).toBeNull();
    expect(await Proposal.countDocuments({ gig: gig._id })).toBe(0);
  });

  it('deletes its uploaded files and decrements postedGigs (P3-13)', async () => {
    const client = await createUser(UserRole.CLIENT);
    await ClientProfile.updateOne({ user: client.user._id }, { postedGigs: 1 });
    const gig = await createGig(client.user._id, {
      attachments: [
        { url: 'https://res.cloudinary.com/demo/image/upload/a.png', publicId: 'gigs/a', name: 'a.png', mimeType: 'image/png' },
        { url: 'https://res.cloudinary.com/demo/raw/upload/b.pdf', publicId: 'gigs/b', name: 'b.pdf', mimeType: 'application/pdf' },
      ],
    });
    const deleteFile = jest.spyOn(uploadService, 'deleteFile').mockResolvedValue();

    await request(app).delete(`/api/v1/gigs/${gig.id}`).set(client.auth).expect(200);
    expect(deleteFile).toHaveBeenCalledWith('gigs/a', 'image');
    expect(deleteFile).toHaveBeenCalledWith('gigs/b', 'raw');
    expect((await ClientProfile.findOne({ user: client.user._id }))!.postedGigs).toBe(0);

    // Never below zero (e.g. gigs created before the counter existed).
    const other = await createGig(client.user._id);
    await request(app).delete(`/api/v1/gigs/${other.id}`).set(client.auth).expect(200);
    expect((await ClientProfile.findOne({ user: client.user._id }))!.postedGigs).toBe(0);
    deleteFile.mockRestore();
  });

  it('refuses to delete a gig that has started (suggests cancelling)', async () => {
    const client = await createUser(UserRole.CLIENT);
    const gig = await createGig(client.user._id, { status: GigStatus.IN_PROGRESS });
    const res = await request(app).delete(`/api/v1/gigs/${gig.id}`).set(client.auth);
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/cancel/i);
  });

  it('refuses to delete a gig with money in escrow', async () => {
    const client = await createUser(UserRole.CLIENT);
    const freelancer = await createUser(UserRole.FREELANCER);
    const gig = await createGig(client.user._id);
    await Payment.create({ gig: gig._id, client: client.user._id, freelancer: freelancer.user._id, amount: 100, status: PaymentStatus.ESCROW });
    const res = await request(app).delete(`/api/v1/gigs/${gig.id}`).set(client.auth);
    expect(res.status).toBe(409);
    expect(await Gig.exists({ _id: gig._id })).not.toBeNull();
  });

  it('only the owner (or an admin) can delete', async () => {
    const client = await createUser(UserRole.CLIENT);
    const other = await createUser(UserRole.CLIENT);
    const gig = await createGig(client.user._id);
    expect((await request(app).delete(`/api/v1/gigs/${gig.id}`).set(other.auth)).status).toBe(403);
  });
});

describe('PUT /api/v1/gigs/:id/cancel (1.15)', () => {
  it('cancels the gig and rejects open proposals', async () => {
    const client = await createUser(UserRole.CLIENT);
    const freelancer = await createUser(UserRole.FREELANCER);
    const gig = await createGig(client.user._id);
    const proposal = await addProposal(gig._id, freelancer.user._id);

    const res = await request(app).put(`/api/v1/gigs/${gig.id}/cancel`).set(client.auth);
    expect(res.status).toBe(200);
    expect((await Gig.findById(gig._id))!.status).toBe(GigStatus.CANCELLED);
    expect((await Proposal.findById(proposal._id))!.status).toBe(ProposalStatus.REJECTED);
  });

  it('refuses while money is held in escrow', async () => {
    const client = await createUser(UserRole.CLIENT);
    const freelancer = await createUser(UserRole.FREELANCER);
    const gig = await createGig(client.user._id, { status: GigStatus.IN_PROGRESS, selectedFreelancer: freelancer.user._id });
    await Payment.create({ gig: gig._id, client: client.user._id, freelancer: freelancer.user._id, amount: 100, status: PaymentStatus.ESCROW });
    expect((await request(app).put(`/api/v1/gigs/${gig.id}/cancel`).set(client.auth)).status).toBe(409);
  });

  it('refuses completed gigs and non-owners', async () => {
    const client = await createUser(UserRole.CLIENT);
    const other = await createUser(UserRole.CLIENT);
    const done = await createGig(client.user._id, { status: GigStatus.COMPLETED });
    expect((await request(app).put(`/api/v1/gigs/${done.id}/cancel`).set(client.auth)).status).toBe(409);
    const open = await createGig(client.user._id);
    expect((await request(app).put(`/api/v1/gigs/${open.id}/cancel`).set(other.auth)).status).toBe(403);
  });
});
