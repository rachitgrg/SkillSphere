import request from 'supertest';
import app from '../src/app';
import FreelancerProfile from '../src/models/FreelancerProfile';
import Gig from '../src/models/Gig';
import Proposal from '../src/models/Proposal';
import User from '../src/models/User';
import aiMatchingService, { MATCH_WEIGHTS, scoreMatch, distanceKm } from '../src/services/aiMatchingService';
import embeddingService, { jaccard, skillCoverage } from '../src/services/embeddingService';
import { AvailabilityStatus, ProficiencyLevel, UserRole } from '../src/types';
import { createGig, createUser } from './helpers';

// Connaught Place, Delhi and a point ~10 km away; Mumbai is ~1150 km away.
const DELHI = { type: 'Point' as const, coordinates: [77.2167, 28.6315] as [number, number] };
const DELHI_10KM = { type: 'Point' as const, coordinates: [77.3167, 28.6315] as [number, number] };
const MUMBAI = { type: 'Point' as const, coordinates: [72.8777, 19.076] as [number, number] };

const skill = (name: string, proficiency = ProficiencyLevel.ADVANCED) => ({ name, proficiency, yearsOfExperience: 3 });

const freelancer = async (profile: Record<string, unknown>, userOverrides: Record<string, unknown> = {}) => {
  const f = await createUser(UserRole.FREELANCER, userOverrides);
  await FreelancerProfile.updateOne({ user: f.user._id }, { $set: profile });
  return f;
};

describe('match scoring (4.2)', () => {
  const gig = {
    title: 'React dashboard',
    description: 'Charts',
    category: 'Web',
    skills: ['React', 'Node.js'],
    experienceLevel: 'intermediate' as const,
    budgetType: 'hourly' as const,
    budgetMax: 1000,
    locationType: 'onsite' as const,
    location: DELHI,
  };
  const profile = {
    title: 'Dev',
    headline: '',
    skills: [skill('react'), skill('NodeJS')],
    averageRating: 0,
    totalReviews: 0,
    hourlyRate: 800,
    availability: AvailabilityStatus.AVAILABLE,
    location: DELHI_10KM,
    milestonePricing: [],
  };

  it('weights sum to 1', () => {
    expect(Object.values(MATCH_WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });

  it('normalises skills for the fallback similarity', () => {
    expect(skillCoverage(['React', 'Node.js'], ['react', 'NodeJS']).ratio).toBe(1);
    expect(jaccard(['C++', 'C#'], ['c++'])).toBeCloseTo(0.5);
  });

  it('scores proximity linearly up to 50 km for onsite gigs and 1 for remote', () => {
    expect(distanceKm(DELHI, DELHI_10KM)).toBeGreaterThan(9);
    const near = scoreMatch(gig, profile);
    expect(near.breakdown.proximity).toBeCloseTo(1 - near.distanceKm! / 50, 1);
    expect(scoreMatch(gig, { ...profile, location: MUMBAI }).breakdown.proximity).toBe(0);
    expect(scoreMatch({ ...gig, locationType: 'remote' }, { ...profile, location: MUMBAI }).breakdown.proximity).toBe(1);
  });

  it('uses a Bayesian rating so one 5★ review does not beat many 4.8★ reviews', () => {
    const one = scoreMatch(gig, { ...profile, averageRating: 5, totalReviews: 1 }, 4);
    const many = scoreMatch(gig, { ...profile, averageRating: 4.8, totalReviews: 40 }, 4);
    expect(many.breakdown.rating).toBeGreaterThan(one.breakdown.rating);
  });

  it('reports source "fallback" without embeddings and "ai" when both have embeddings', () => {
    expect(scoreMatch(gig, profile).source).toBe('fallback');
    const vec = Array.from({ length: 384 }, (_, i) => Math.sin(i));
    const result = scoreMatch({ ...gig, embedding: vec }, { ...profile, embedding: vec });
    expect(result.source).toBe('ai');
    expect(result.breakdown.skill).toBe(1);
  });

  it('penalises rates above the budget', () => {
    expect(scoreMatch(gig, profile).breakdown.budget).toBe(1);
    expect(scoreMatch(gig, { ...profile, hourlyRate: 1500 }).breakdown.budget).toBe(0.5);
  });
});

describe('embedding service without a token', () => {
  it('returns null instead of calling Hugging Face', async () => {
    embeddingService.reset();
    expect(await embeddingService.embed('React developer')).toBeNull();
  });
});

describe('GET /ai/gigs/:gigId/matches (4.2)', () => {
  it('ranks nearby, skilled freelancers first and excludes banned or unrelated ones', async () => {
    const client = await createUser(UserRole.CLIENT);
    const gig = await createGig(client.user._id, { skills: ['React', 'Node.js'], locationType: 'onsite', location: DELHI });

    const near = await freelancer({ skills: [skill('React'), skill('Node.js')], location: DELHI_10KM, averageRating: 4.5, totalReviews: 6 });
    const far = await freelancer({ skills: [skill('React'), skill('Node.js')], location: MUMBAI, averageRating: 4.5, totalReviews: 6 });
    const banned = await freelancer({ skills: [skill('React')], location: DELHI_10KM }, { isBanned: true });
    const unrelated = await freelancer({ skills: [skill('Photoshop')], location: DELHI_10KM });

    const res = await request(app).get(`/api/v1/ai/gigs/${gig._id}/matches`).set(client.auth).expect(200);
    const ids = res.body.data.map((m: { freelancerId: { _id: string } }) => m.freelancerId._id);
    expect(ids[0]).toBe(near.user._id.toString());
    expect(ids).toContain(far.user._id.toString());
    expect(ids).not.toContain(banned.user._id.toString());
    expect(ids).not.toContain(unrelated.user._id.toString());

    const top = res.body.data[0];
    expect(Object.keys(top.breakdown).sort()).toEqual(Object.keys(MATCH_WEIGHTS).sort());
    expect(top.source).toBe('fallback');
    expect(top.score).toBeGreaterThan(res.body.data[1].score);
    expect(top.profile.embedding).toBeUndefined();
  });

  it('is only available to the gig owner', async () => {
    const owner = await createUser(UserRole.CLIENT);
    const other = await createUser(UserRole.CLIENT);
    const gig = await createGig(owner.user._id);
    await request(app).get(`/api/v1/ai/gigs/${gig._id}/matches`).set(other.auth).expect(404);
  });

  it('never returns embeddings from gig endpoints', async () => {
    const client = await createUser(UserRole.CLIENT);
    const gig = await createGig(client.user._id);
    await Gig.updateOne({ _id: gig._id }, { $set: { embedding: [0.1, 0.2] } });
    const res = await request(app).get(`/api/v1/gigs/${gig._id}`).expect(200);
    expect(res.body.data.embedding).toBeUndefined();
  });
});

describe('GET /ai/recommendations (4.2)', () => {
  it('ranks open gigs for the freelancer and skips gigs already applied to', async () => {
    const client = await createUser(UserRole.CLIENT);
    const f = await freelancer({ skills: [skill('React'), skill('TypeScript')] });
    const best = await createGig(client.user._id, { title: 'React + TS', skills: ['React', 'TypeScript'] });
    const partial = await createGig(client.user._id, { title: 'React + Go', skills: ['React', 'Go', 'Kubernetes'] });
    const applied = await createGig(client.user._id, { title: 'Applied', skills: ['React'] });
    await createGig(client.user._id, { title: 'Unrelated', skills: ['Photoshop'] });
    await Proposal.create({ gig: applied._id, freelancer: f.user._id, coverLetter: 'x'.repeat(60), proposedAmount: 6000, estimatedDuration: '1 week' });

    const res = await request(app).get('/api/v1/ai/recommendations').set(f.auth).expect(200);
    const titles = res.body.data.map((r: { gig: { title: string } }) => r.gig.title);
    expect(titles).toEqual([best.title, partial.title]);
    expect(res.body.data[0].matchedSkills).toEqual(['React', 'TypeScript']);
  });
});

describe('POST /ai/career-analysis (4.2)', () => {
  it('labels the non-AI fallback', async () => {
    const f = await createUser(UserRole.FREELANCER);
    const res = await request(app)
      .post('/api/v1/ai/career-analysis')
      .set(f.auth)
      .send({ resumeText: 'Frontend developer with 3 years of React and Node experience.' })
      .expect(200);
    expect(res.body.data.source).toBe('fallback');
    expect(res.body.data.targetRoles.length).toBeGreaterThan(0);
  });
});

describe('platform rating prior', () => {
  it('defaults to 4 with no reviews and averages reviewed freelancers otherwise', async () => {
    expect(await aiMatchingService.platformRating()).toBe(4);
    await freelancer({ averageRating: 3, totalReviews: 2 });
    await freelancer({ averageRating: 5, totalReviews: 2 });
    expect(await aiMatchingService.platformRating()).toBe(4);
    expect(await User.countDocuments()).toBe(2);
  });
});
