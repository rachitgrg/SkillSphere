import User from '../src/models/User';
import ClientProfile from '../src/models/ClientProfile';
import FreelancerProfile from '../src/models/FreelancerProfile';
import Gig from '../src/models/Gig';
import { GigStatus, UserRole } from '../src/types';
import { generateAccessToken } from '../src/utils/generateToken';

let counter = 0;

export const STRONG_PASSWORD = 'Str0ngPass!';

/** Creates a user (plus role profile) directly in the DB and returns a bearer token. */
export const createUser = async (role: UserRole = UserRole.FREELANCER, overrides: Record<string, unknown> = {}) => {
  counter += 1;
  const user = await User.create({
    firstName: 'Test',
    lastName: `${role}${counter}`,
    email: `${role}${counter}@test.dev`,
    password: STRONG_PASSWORD,
    role,
    isVerified: true,
    ...overrides,
  });
  if (role === UserRole.CLIENT) await ClientProfile.create({ user: user._id });
  if (role === UserRole.FREELANCER) await FreelancerProfile.create({ user: user._id, title: 'Developer' });

  const token = generateAccessToken({ id: user._id.toString(), role: user.role });
  return { user, token, auth: { Authorization: `Bearer ${token}` } };
};

/** Creates an open, public gig owned by `clientId`. */
export const createGig = (clientId: unknown, overrides: Record<string, unknown> = {}) =>
  new Gig({
    client: clientId,
    title: 'Build a React dashboard',
    description: 'Charts and tables',
    category: 'Web Development',
    skills: ['React'],
    budgetType: 'fixed',
    budgetMin: 5000,
    budgetMax: 10000,
    duration: '2 weeks',
    experienceLevel: 'intermediate',
    status: GigStatus.OPEN,
    ...overrides,
  }).save();
