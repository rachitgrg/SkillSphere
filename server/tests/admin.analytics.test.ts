import request from 'supertest';
import { Types } from 'mongoose';
import app from '../src/app';
import Dispute from '../src/models/Dispute';
import { DisputeStatus, GigStatus, UserRole } from '../src/types';
import { createGig, createUser } from './helpers';

describe('admin job success rate (P2-5)', () => {
  it('counts every finished gig once, by its final outcome', async () => {
    const admin = await createUser(UserRole.ADMIN);
    const client = await createUser(UserRole.CLIENT);
    const freelancer = await createUser(UserRole.FREELANCER);
    const gig = (status: GigStatus) => createGig(client.user._id, { status, selectedFreelancer: freelancer.user._id });
    const dispute = (gigId: Types.ObjectId, paymentAction: 'refund' | 'release' | 'split') =>
      Dispute.create({ gig: gigId, raisedBy: client.user._id, against: freelancer.user._id, title: 'x', description: 'y', status: DisputeStatus.RESOLVED, paymentAction });

    await gig(GigStatus.COMPLETED);
    await gig(GigStatus.COMPLETED);
    const releasedAfterDispute = await gig(GigStatus.COMPLETED); // dispute the freelancer won: still a success
    await dispute(releasedAfterDispute._id, 'release');
    const refunded = await gig(GigStatus.COMPLETED); // completed after the client won a dispute
    await dispute(refunded._id, 'refund');
    const cancelled = await gig(GigStatus.CANCELLED);
    await dispute(cancelled._id, 'refund'); // still just one cancelled gig
    const ongoing = await gig(GigStatus.IN_PROGRESS); // open dispute on an unfinished gig: not counted
    await Dispute.create({ gig: ongoing._id, raisedBy: client.user._id, against: freelancer.user._id, title: 'x', description: 'y' });

    const res = await request(app).get('/api/v1/admin/analytics').set(admin.auth).expect(200);
    expect(res.body.data.jobOutcomes).toEqual({ completed: 3, cancelled: 1, disputed: 1 });
    expect(res.body.data.jobSuccessRate).toBe(60); // 3 / (3 + 1 + 1)
  });
});
