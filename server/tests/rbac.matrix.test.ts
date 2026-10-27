import request from 'supertest';
import { Types } from 'mongoose';
import app from '../src/app';
import { ROUTES } from '../src/docs/openapi';
import { UserRole } from '../src/types';
import { createUser } from './helpers';

/**
 * RBAC matrix generated from the documented `access` of every route: anonymous callers get 401 on
 * protected routes, and each role outside a route's allowed roles gets 403 before any handler runs.
 */
const ROLES = [UserRole.CLIENT, UserRole.FREELANCER, UserRole.ADMIN] as const;
const ROLE_ACCESS = new Set(['client', 'freelancer', 'admin', 'client|freelancer', 'client|admin']);

const concrete = (path: string) => `/api/v1${path.replace(/:[A-Za-z]+/g, () => new Types.ObjectId().toString())}`;
const call = (method: string, path: string) => (request(app) as unknown as Record<string, (url: string) => request.Test>)[method](concrete(path));

let auth: Record<(typeof ROLES)[number], { Authorization: string }>;

// tests/setup.ts empties the database after every test, so the users are recreated each time.
beforeEach(async () => {
  const [client, freelancer, admin] = await Promise.all(ROLES.map((role) => createUser(role)));
  auth = { client: client.auth, freelancer: freelancer.auth, admin: admin.auth };
});

const protectedRoutes = ROUTES.filter((r) => r.access !== 'public' && r.access !== 'cookie');
const roleRoutes = ROUTES.filter((r) => ROLE_ACCESS.has(r.access));

describe('RBAC matrix', () => {
  it.each(protectedRoutes.map((r) => [`${r.method.toUpperCase()} ${r.path}`, r] as const))('%s rejects anonymous callers', async (_name, route) => {
    expect((await call(route.method, route.path)).status).toBe(401);
  });

  const forbidden = roleRoutes.flatMap((r) =>
    ROLES.filter((role) => !r.access.split('|').includes(role)).map((role) => [`${r.method.toUpperCase()} ${r.path} as ${role}`, r, role] as const)
  );

  it.each(forbidden)('%s is forbidden', async (_name, route, role) => {
    const res = await call(route.method, route.path).set(auth[role]);
    expect(res.status).toBe(403);
  });
});
