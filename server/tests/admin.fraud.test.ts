import request from 'supertest';
import app from '../src/app';
import Payment from '../src/models/Payment';
import User from '../src/models/User';
import { PaymentStatus, UserRole } from '../src/types';
import { createGig, createUser } from './helpers';

describe('admin fraud & payment monitoring (4.9)', () => {
  it('groups accounts sharing a login IP and clients with repeated failed payments', async () => {
    const admin = await createUser(UserRole.ADMIN);
    const a = await createUser(UserRole.CLIENT);
    const b = await createUser(UserRole.FREELANCER);
    const c = await createUser(UserRole.FREELANCER);
    await User.updateMany({ _id: { $in: [a.user._id, b.user._id] } }, { $set: { lastLoginIp: '203.0.113.9' } });
    await User.updateOne({ _id: c.user._id }, { $set: { lastLoginIp: '198.51.100.1' } });
    await User.updateOne({ _id: admin.user._id }, { $set: { lastLoginIp: '203.0.113.9' } }); // admins are ignored
    const local = await Promise.all([createUser(UserRole.CLIENT), createUser(UserRole.FREELANCER)]);
    await User.updateMany({ _id: { $in: local.map((u) => u.user._id) } }, { $set: { lastLoginIp: '::ffff:127.0.0.1' } }); // loopback is ignored

    const gig = await createGig(a.user._id);
    await Payment.insertMany(
      [1, 2, 3].map(() => ({ gig: gig._id, client: a.user._id, freelancer: b.user._id, amount: 100, platformFee: 10, freelancerAmount: 90, status: PaymentStatus.FAILED }))
    );
    await Payment.create({ gig: gig._id, client: a.user._id, freelancer: b.user._id, amount: 1000, status: PaymentStatus.RELEASED, payout: { status: 'queued' } });

    const res = await request(app).get('/api/v1/admin/fraud').set(admin.auth).expect(200);
    expect(res.body.data.sharedIps).toHaveLength(1);
    expect(res.body.data.sharedIps[0].ip).toBe('203.0.113.9');
    expect(res.body.data.sharedIps[0].users.map((u: { _id: string }) => u._id).sort()).toEqual([a.user.id, b.user.id].sort());
    expect(res.body.data.failedPayers[0]).toMatchObject({ failures: 3, user: { email: a.user.email } });

    const payments = await request(app).get('/api/v1/admin/payments?status=failed').set(admin.auth).expect(200);
    expect(payments.body.pagination.total).toBe(3);
    expect(payments.body.data.payouts).toEqual([{ _id: 'queued', amount: 900, count: 1 }]);
  });
});
