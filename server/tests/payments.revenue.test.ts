import Payment from '../src/models/Payment';
import paymentService from '../src/services/paymentService';
import { PaymentStatus, UserRole } from '../src/types';
import { createGig, createUser } from './helpers';

describe('platform revenue (P2-1)', () => {
  it('counts fees on released payments only, dated by release', async () => {
    const client = await createUser(UserRole.CLIENT);
    const freelancer = await createUser(UserRole.FREELANCER);
    const gig = await createGig(client.user._id);
    const pay = (status: PaymentStatus, extra: Record<string, unknown> = {}) =>
      Payment.create({ gig: gig._id, client: client.user._id, freelancer: freelancer.user._id, amount: 10000, status, ...extra });

    const released = await pay(PaymentStatus.RELEASED, { releasedAt: new Date('2026-10-15') });
    await pay(PaymentStatus.RELEASED, { releasedAt: new Date('2026-06-01') });
    await pay(PaymentStatus.ESCROW); // can still be refunded
    await pay(PaymentStatus.DISPUTED);
    await pay(PaymentStatus.REFUNDED);

    const all = await paymentService.calculatePlatformRevenue();
    expect(all).toEqual({ totalRevenue: released.platformFee * 2, totalTransactions: 2 });
    expect(released.platformFee).toBeGreaterThan(0);

    const october = await paymentService.calculatePlatformRevenue(new Date('2026-10-01'), new Date('2026-10-31'));
    expect(october).toEqual({ totalRevenue: released.platformFee, totalTransactions: 1 });
  });
});
