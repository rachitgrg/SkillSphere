import { Types } from 'mongoose';
import Payment from '../src/models/Payment';
import Review from '../src/models/Review';

describe('Mongoose 9 hooks (C3)', () => {
  it('saves a Payment and computes the platform fee split', async () => {
    const payment = await Payment.create({
      gig: new Types.ObjectId(),
      client: new Types.ObjectId(),
      freelancer: new Types.ObjectId(),
      amount: 1000,
    });
    expect(payment.platformFee).toBe(100); // default 10%
    expect(payment.freelancerAmount).toBe(900);
  });

  it('recomputes the split when the amount changes', async () => {
    const payment = await Payment.create({
      gig: new Types.ObjectId(),
      client: new Types.ObjectId(),
      freelancer: new Types.ObjectId(),
      amount: 1000,
    });
    payment.amount = 2500;
    await payment.save();
    expect(payment.platformFee).toBe(250);
    expect(payment.freelancerAmount).toBe(2250);
  });

  it('saves a Review without a client-supplied rating and applies the weighted formula', async () => {
    const categories = { quality: 5, communication: 4, timeliness: 3, professionalism: 4, value: 2 };
    const review = await Review.create({
      gig: new Types.ObjectId(),
      reviewer: new Types.ObjectId(),
      reviewee: new Types.ObjectId(),
      categories,
      comment: 'Solid work overall.',
    });
    const expected = Math.round((5 * 0.3 + 4 * 0.2 + 3 * 0.2 + 4 * 0.15 + 2 * 0.15) * 100) / 100;
    expect(review.rating).toBe(expected);
  });

  it('ignores a client-supplied rating', async () => {
    const review = await Review.create({
      gig: new Types.ObjectId(),
      reviewer: new Types.ObjectId(),
      reviewee: new Types.ObjectId(),
      rating: 5,
      categories: { quality: 1, communication: 1, timeliness: 1, professionalism: 1, value: 1 },
      comment: 'Not great.',
    });
    expect(review.rating).toBe(1);
  });

  it('reports missing categories as a validation error instead of crashing', async () => {
    await expect(
      Review.create({
        gig: new Types.ObjectId(),
        reviewer: new Types.ObjectId(),
        reviewee: new Types.ObjectId(),
        comment: 'x',
      })
    ).rejects.toMatchObject({ name: 'ValidationError' });
  });
});
