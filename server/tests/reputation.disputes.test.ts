import Dispute from '../src/models/Dispute';
import FreelancerProfile from '../src/models/FreelancerProfile';
import ClientProfile from '../src/models/ClientProfile';
import reputationService, { REPUTATION, computeReputation } from '../src/services/reputationService';
import { DisputeStatus, GigStatus, UserRole } from '../src/types';
import { createGig, createUser } from './helpers';

/** Two completed gigs between the pair plus one resolved dispute with `action`. */
const setup = async (action: 'refund' | 'release' | 'split') => {
  const client = await createUser(UserRole.CLIENT);
  const freelancer = await createUser(UserRole.FREELANCER);
  const gigs = await Promise.all(
    [0, 1].map(() => createGig(client.user._id, { status: GigStatus.COMPLETED, selectedFreelancer: freelancer.user._id }))
  );
  await Dispute.create({ gig: gigs[0]._id, raisedBy: client.user._id, against: freelancer.user._id, title: 'x', description: 'y', status: DisputeStatus.RESOLVED, paymentAction: action });
  await reputationService.updateUserReputation(freelancer.user._id);
  await reputationService.updateUserReputation(client.user._id);
  return {
    freelancerScore: (await FreelancerProfile.findOne({ user: freelancer.user._id }))!.reputationScore,
    clientScore: (await ClientProfile.findOne({ user: client.user._id }))!.reputationScore,
  };
};

const scoreWith = (failed: number) => computeReputation({ reviews: [], platformMean: REPUTATION.DEFAULT_PLATFORM_RATING, completed: 2, failed }).score;

describe('disputes in the completion rate (P2-14)', () => {
  it('a refund is a full failure for the freelancer only', async () => {
    expect(await setup('refund')).toEqual({ freelancerScore: scoreWith(1), clientScore: scoreWith(0) });
  });

  it('a release is a full failure for the client only', async () => {
    expect(await setup('release')).toEqual({ freelancerScore: scoreWith(0), clientScore: scoreWith(1) });
  });

  it('a split counts as half a failure for both', async () => {
    const half = scoreWith(REPUTATION.SPLIT_DISPUTE_FAILURE);
    expect(await setup('split')).toEqual({ freelancerScore: half, clientScore: half });
    expect(half).toBeLessThan(scoreWith(0));
    expect(half).toBeGreaterThan(scoreWith(1));
  });
});
