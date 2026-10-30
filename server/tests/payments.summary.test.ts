import request from 'supertest';
import app from '../src/app';
import Payment from '../src/models/Payment';
import { PaymentStatus, UserRole } from '../src/types';
import { createGig, createUser } from './helpers';

describe('GET /payments/summary (P2-6)', () => {
  it('gives admins platform-wide totals and everyone else their own', async () => {
    const admin = await createUser(UserRole.ADMIN);
    const [c1, c2] = await Promise.all([createUser(UserRole.CLIENT), createUser(UserRole.CLIENT)]);
    const freelancer = await createUser(UserRole.FREELANCER);
    const gig = await createGig(c1.user._id);
    const pay = (client: typeof c1, amount: number, status: PaymentStatus) =>
      Payment.create({ gig: gig._id, client: client.user._id, freelancer: freelancer.user._id, amount, status });
    const a = await pay(c1, 10000, PaymentStatus.RELEASED);
    const b = await pay(c2, 5000, PaymentStatus.RELEASED);
    await pay(c2, 3000, PaymentStatus.ESCROW);

    const platform = (await request(app).get('/api/v1/payments/summary').set(admin.auth).expect(200)).body.data;
    expect(platform).toMatchObject({ released: 15000, inEscrow: 3000, fees: a.platformFee + b.platformFee });

    const mine = (await request(app).get('/api/v1/payments/summary').set(c1.auth).expect(200)).body.data;
    expect(mine).toMatchObject({ released: 10000, inEscrow: 0, fees: a.platformFee });

    const earned = (await request(app).get('/api/v1/payments/summary').set(freelancer.auth).expect(200)).body.data;
    expect(earned.released).toBe(a.freelancerAmount + b.freelancerAmount);
  });
});
