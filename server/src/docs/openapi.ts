import { z, ZodObject, ZodType } from 'zod';
import * as v from '../utils/validators';

/**
 * OpenAPI 3.1 document served at /api/docs. Routes are declared once here; request bodies are
 * generated from the same zod schemas the validate() middleware uses, so docs can't drift from
 * validation. tests/docs.test.ts fails if a registered route is missing.
 */

type Method = 'get' | 'post' | 'put' | 'delete';
type Access = 'public' | 'auth' | 'client' | 'freelancer' | 'admin' | 'client|freelancer' | 'client|admin' | 'cookie';

interface RouteDoc {
  method: Method;
  path: string; // Express style, relative to /api/v1
  tag: string;
  summary: string;
  access: Access;
  body?: ZodType;
  query?: Record<string, string>; // name → description
  description?: string;
}

/** The `body` part of a `{ body, params, query }` validator schema. */
const bodyOf = (schema: ZodObject) => schema.shape.body as ZodType;

const pageQuery = { page: 'Page number (default 1)', limit: 'Page size (default 10, max 50)' };

export const ROUTES: RouteDoc[] = [
  // Auth
  { method: 'post', path: '/auth/register', tag: 'Auth', summary: 'Register a client or freelancer', access: 'public', body: bodyOf(v.registerSchema), description: 'Sets the httpOnly refresh cookie and returns `{ user, token }`.' },
  { method: 'post', path: '/auth/login', tag: 'Auth', summary: 'Log in', access: 'public', body: bodyOf(v.loginSchema) },
  { method: 'post', path: '/auth/refresh', tag: 'Auth', summary: 'Rotate the refresh cookie and get a new access token', access: 'cookie' },
  { method: 'post', path: '/auth/logout', tag: 'Auth', summary: 'Revoke the refresh token and clear the cookie', access: 'cookie' },
  { method: 'get', path: '/auth/me', tag: 'Auth', summary: 'Current user', access: 'auth' },
  { method: 'put', path: '/auth/change-password', tag: 'Auth', summary: 'Change password (revokes other sessions)', access: 'auth', body: bodyOf(v.changePasswordSchema) },

  // Users
  { method: 'get', path: '/users/me', tag: 'Users', summary: 'Current user and role profile', access: 'auth' },
  { method: 'put', path: '/users/me', tag: 'Users', summary: 'Update name, bio, address or GeoJSON location', access: 'auth', body: bodyOf(v.updateProfileSchema) },
  { method: 'put', path: '/users/freelancers/me', tag: 'Users', summary: 'Update the freelancer profile', access: 'freelancer', body: bodyOf(v.updateFreelancerProfileSchema) },
  { method: 'get', path: '/users/freelancers/:userId', tag: 'Users', summary: 'Public freelancer profile', access: 'public' },
  { method: 'put', path: '/users/clients/me', tag: 'Users', summary: 'Update the client profile', access: 'client', body: bodyOf(v.updateClientProfileSchema) },
  { method: 'get', path: '/users/clients/:userId', tag: 'Users', summary: 'Public client profile', access: 'public' },

  // Gigs
  {
    method: 'get', path: '/gigs/', tag: 'Gigs', summary: 'Marketplace: open, public gigs', access: 'public',
    query: { q: 'Text search', category: 'Category', skills: 'Comma list or repeated param', budgetMin: 'Overlap lower bound (INR)', budgetMax: 'Overlap upper bound (INR)', budgetType: 'fixed | hourly', experienceLevel: 'entry | intermediate | expert', locationType: 'remote | onsite | hybrid', sort: 'newest | oldest | budget_high | budget_low | popular', ...pageQuery },
  },
  { method: 'get', path: '/gigs/mine', tag: 'Gigs', summary: "The client's own gigs (all statuses)", access: 'client', query: { status: 'Comma list of statuses', ...pageQuery } },
  { method: 'get', path: '/gigs/:id', tag: 'Gigs', summary: 'Gig details (non-public gigs only for their parties)', access: 'public' },
  { method: 'post', path: '/gigs/', tag: 'Gigs', summary: 'Create a gig (goes to the admin approval queue)', access: 'client', body: bodyOf(v.createGigSchema) },
  { method: 'put', path: '/gigs/:id', tag: 'Gigs', summary: 'Edit a gig before work starts', access: 'client', body: bodyOf(v.updateGigSchema) },
  { method: 'put', path: '/gigs/:id/cancel', tag: 'Gigs', summary: 'Cancel a gig (no escrowed money)', access: 'client' },
  { method: 'delete', path: '/gigs/:id', tag: 'Gigs', summary: 'Delete a gig that has not started', access: 'client|admin' },

  // Proposals
  { method: 'post', path: '/proposals/', tag: 'Proposals', summary: 'Submit a proposal to an open gig', access: 'freelancer', body: bodyOf(v.createProposalSchema) },
  { method: 'get', path: '/proposals/mine', tag: 'Proposals', summary: "The freelancer's proposals", access: 'freelancer', query: { status: 'Comma list of statuses', ...pageQuery } },
  { method: 'get', path: '/proposals/gig/:gigId', tag: 'Proposals', summary: 'Proposals for a gig (owner or admin)', access: 'auth' },
  { method: 'get', path: '/proposals/:id', tag: 'Proposals', summary: 'One proposal (gig owner or author)', access: 'auth' },
  { method: 'post', path: '/proposals/:id/negotiate', tag: 'Proposals', summary: 'Counter-offer (either party); last amount becomes finalAmount', access: 'client|freelancer', body: bodyOf(v.negotiateProposalSchema) },
  { method: 'put', path: '/proposals/:id/withdraw', tag: 'Proposals', summary: 'Withdraw a pending/negotiating proposal', access: 'freelancer' },
  { method: 'put', path: '/proposals/:id/status', tag: 'Proposals', summary: 'Accept (hire), reject or mark negotiating', access: 'client', body: bodyOf(v.updateProposalStatusSchema) },

  // Chat
  { method: 'get', path: '/chat/conversations', tag: 'Chat', summary: 'My conversations with unread counts', access: 'auth' },
  { method: 'post', path: '/chat/conversations', tag: 'Chat', summary: 'Open (or reuse) a conversation', access: 'auth', body: bodyOf(v.createConversationSchema) },
  { method: 'get', path: '/chat/conversations/:id/messages', tag: 'Chat', summary: 'Message history (cursor pagination)', access: 'auth', query: { before: 'Message id or ISO date; loads older messages', limit: 'Default 30, max 100' } },

  // Payments
  { method: 'get', path: '/payments/', tag: 'Payments', summary: 'Transaction history', access: 'auth', query: { status: 'Payment status', gig: 'Gig id', ...pageQuery } },
  { method: 'get', path: '/payments/summary', tag: 'Payments', summary: 'Totals in escrow, released, refunded, fees', access: 'auth' },
  { method: 'get', path: '/payments/config', tag: 'Payments', summary: 'Razorpay key id for Checkout (test mode)', access: 'auth' },
  { method: 'post', path: '/payments/orders', tag: 'Payments', summary: 'Create a Razorpay order to fund escrow', access: 'client', body: bodyOf(v.createPaymentSchema), description: '503 when Razorpay keys are not configured.' },
  { method: 'post', path: '/payments/verify', tag: 'Payments', summary: 'Verify the Checkout signature; payment → escrow', access: 'client', body: bodyOf(v.verifyPaymentSchema) },
  { method: 'post', path: '/payments/:id/release', tag: 'Payments', summary: 'Release escrow to the freelancer', access: 'client' },
  { method: 'post', path: '/payments/:id/refund', tag: 'Payments', summary: 'Refund escrow before work starts (Razorpay test refund)', access: 'client', body: bodyOf(v.refundPaymentSchema) },

  // Reviews
  { method: 'post', path: '/reviews/', tag: 'Reviews', summary: 'Review the other party of a completed gig', access: 'auth', body: bodyOf(v.createReviewSchema) },
  { method: 'get', path: '/reviews/user/:userId', tag: 'Reviews', summary: "A user's visible reviews", access: 'public' },
  { method: 'get', path: '/reviews/user/:userId/breakdown', tag: 'Reviews', summary: 'Rating distribution and category averages', access: 'public' },
  { method: 'post', path: '/reviews/:id/reply', tag: 'Reviews', summary: 'Reviewee replies once', access: 'auth', body: bodyOf(v.respondReviewSchema) },
  { method: 'post', path: '/reviews/:id/report', tag: 'Reviews', summary: 'Report a review for moderation', access: 'auth', body: bodyOf(v.reportReviewSchema) },

  // Notifications
  { method: 'get', path: '/notifications/', tag: 'Notifications', summary: 'My notifications', access: 'auth', query: { unread: 'true for unread only', ...pageQuery } },
  { method: 'get', path: '/notifications/unread-count', tag: 'Notifications', summary: 'Unread count', access: 'auth' },
  { method: 'put', path: '/notifications/:id/read', tag: 'Notifications', summary: 'Mark one as read', access: 'auth' },
  { method: 'put', path: '/notifications/read-all', tag: 'Notifications', summary: 'Mark all as read', access: 'auth' },
  { method: 'delete', path: '/notifications/:id', tag: 'Notifications', summary: 'Delete one', access: 'auth' },

  // Search
  { method: 'get', path: '/search/gigs', tag: 'Search', summary: 'Gig search (same filters as GET /gigs)', access: 'public' },
  {
    method: 'get', path: '/search/freelancers', tag: 'Search', summary: 'Freelancer search', access: 'public',
    query: { q: 'Text search over title/headline/skills', skills: 'Comma list', minRate: 'INR/hour', maxRate: 'INR/hour', minRating: '0-5', experience: 'entry | intermediate | expert | min years', sort: 'rating | rate_low | rate_high | experience | newest', ...pageQuery },
  },
  { method: 'get', path: '/search/trending-skills', tag: 'Search', summary: 'Skills trending in new gigs (cached 1h)', access: 'public', query: { days: 'Window in days (default 30)', limit: 'Default 15' } },
  { method: 'get', path: '/search/categories', tag: 'Search', summary: 'Categories of open gigs with counts', access: 'public' },
  { method: 'get', path: '/search/suggestions', tag: 'Search', summary: 'Title and skill suggestions', access: 'public', query: { q: 'At least 2 characters' } },

  // AI
  { method: 'get', path: '/ai/gigs/:gigId/matches', tag: 'AI', summary: 'Ranked freelancers for my gig', access: 'client', query: { limit: 'Default 10' } },
  { method: 'get', path: '/ai/recommendations', tag: 'AI', summary: 'Open gigs ranked for me', access: 'freelancer', query: { limit: 'Default 10' } },
  { method: 'post', path: '/ai/career-analysis', tag: 'AI', summary: 'Resume → career report', access: 'freelancer', body: bodyOf(v.careerAnalysisSchema) },

  // Analytics
  { method: 'get', path: '/analytics/freelancer', tag: 'Analytics', summary: 'Proposals, earnings, monthly revenue, feedback', access: 'freelancer', query: { period: '30d | 90d | 12m' } },
  { method: 'get', path: '/analytics/client', tag: 'Analytics', summary: 'Spending, hires and gig pipeline', access: 'client', query: { period: '30d | 90d | 12m' } },

  // Disputes
  { method: 'post', path: '/disputes/', tag: 'Disputes', summary: 'Open a dispute (freezes an escrowed payment)', access: 'client|freelancer', body: bodyOf(v.createDisputeSchema) },
  { method: 'get', path: '/disputes/', tag: 'Disputes', summary: 'My disputes (admins: all)', access: 'auth', query: { status: 'Dispute status', gig: 'Gig id', ...pageQuery } },
  { method: 'get', path: '/disputes/:id', tag: 'Disputes', summary: 'Dispute details', access: 'auth' },
  { method: 'put', path: '/disputes/:id/resolve', tag: 'Disputes', summary: 'Resolve with refund / release / split', access: 'admin', body: bodyOf(v.resolveDisputeSchema) },

  // Admin
  { method: 'get', path: '/admin/stats', tag: 'Admin', summary: 'Dashboard counters', access: 'admin' },
  { method: 'get', path: '/admin/analytics', tag: 'Admin', summary: 'Revenue, active freelancers, top categories, job success rate', access: 'admin', query: { period: '30d | 90d | 12m' } },
  { method: 'get', path: '/admin/users', tag: 'Admin', summary: 'Search users', access: 'admin', query: { search: 'Name or email', role: 'client | freelancer | admin', status: 'active | suspended | inactive', ...pageQuery } },
  { method: 'get', path: '/admin/users/:id', tag: 'Admin', summary: 'User with gigs, payments, reviews, disputes', access: 'admin' },
  { method: 'put', path: '/admin/users/:id/suspend', tag: 'Admin', summary: 'Suspend (optionally for N days); kicks live sockets', access: 'admin', body: bodyOf(v.suspendUserSchema) },
  { method: 'put', path: '/admin/users/:id/unsuspend', tag: 'Admin', summary: 'Lift a suspension', access: 'admin' },
  { method: 'get', path: '/admin/gigs/pending', tag: 'Admin', summary: 'Gig approval queue', access: 'admin', query: pageQuery },
  { method: 'put', path: '/admin/gigs/:id/approve', tag: 'Admin', summary: 'Approve a gig (it goes live)', access: 'admin' },
  { method: 'put', path: '/admin/gigs/:id/reject', tag: 'Admin', summary: 'Reject a gig with a reason', access: 'admin', body: bodyOf(v.rejectGigSchema) },
  { method: 'get', path: '/admin/payments', tag: 'Admin', summary: 'All payments with totals', access: 'admin', query: { status: 'Payment status', ...pageQuery } },
  { method: 'get', path: '/admin/fraud', tag: 'Admin', summary: 'Flagged reviews and suspicious users', access: 'admin' },
  { method: 'put', path: '/admin/reviews/:id/visibility', tag: 'Admin', summary: 'Show or hide a review', access: 'admin', body: bodyOf(v.reviewVisibilitySchema) },
  { method: 'get', path: '/admin/logs', tag: 'Admin', summary: 'Admin audit log', access: 'admin', query: { action: 'AdminAction', ...pageQuery } },
];

const ACCESS_TEXT: Record<Access, string> = {
  public: 'Public.',
  auth: 'Any signed-in user.',
  client: 'Clients only.',
  freelancer: 'Freelancers only.',
  admin: 'Admins only.',
  'client|freelancer': 'Clients and freelancers.',
  'client|admin': 'Gig owner or admin.',
  cookie: 'Uses the httpOnly `refreshToken` cookie (path /api/v1/auth).',
};

const toOpenApiPath = (path: string) => path.replace(/\/$/, '').replace(/:(\w+)/g, '{$1}');

const jsonSchema = (schema: ZodType) => {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema, { unrepresentable: 'any', io: 'input' }) as Record<string, unknown>;
  return rest;
};

export const buildOpenApiDocument = () => {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const route of ROUTES) {
    const params = [...route.path.matchAll(/:(\w+)/g)].map(([, name]) => ({
      name,
      in: 'path',
      required: true,
      schema: { type: 'string' },
    }));
    const query = Object.entries(route.query ?? {}).map(([name, description]) => ({
      name,
      in: 'query',
      required: false,
      description,
      schema: { type: 'string' },
    }));
    const secured = !['public', 'cookie'].includes(route.access);

    paths[toOpenApiPath(route.path)] ??= {};
    paths[toOpenApiPath(route.path)][route.method] = {
      tags: [route.tag],
      summary: route.summary,
      description: [ACCESS_TEXT[route.access], route.description].filter(Boolean).join(' '),
      ...(secured && { security: [{ bearerAuth: [] }] }),
      ...(params.length + query.length && { parameters: [...params, ...query] }),
      ...(route.body && {
        requestBody: { required: true, content: { 'application/json': { schema: jsonSchema(route.body) } } },
      }),
      responses: {
        200: { description: 'OK — `{ success, message, data, pagination? }`' },
        ...(route.method === 'post' && { 201: { description: 'Created' } }),
        400: { description: 'Validation failed' },
        ...(secured && { 401: { description: 'Missing or invalid access token' }, 403: { description: 'Not allowed for this role or resource' } }),
        404: { description: 'Not found' },
      },
    };
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'SkillSphere API',
      version: '1.0.0',
      description:
        'Hyperlocal freelance marketplace API. Send `Authorization: Bearer <accessToken>`; the refresh token is an httpOnly cookie. Amounts are INR.',
    },
    servers: [{ url: '/api/v1' }],
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
    tags: [...new Set(ROUTES.map((r) => r.tag))].map((name) => ({ name })),
    paths,
  };
};
