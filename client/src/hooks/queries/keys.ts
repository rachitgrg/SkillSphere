import type { FreelancerFilters, GigFilters } from '../../types';

/** React Query keys. Invalidate a prefix (e.g. `keys.gigs.all`) to refresh everything under it. */
export const keys = {
  gigs: {
    all: ['gigs'] as const,
    list: (filters: GigFilters) => ['gigs', 'list', filters] as const,
    mine: (params: object) => ['gigs', 'mine', params] as const,
    detail: (id: string) => ['gigs', 'detail', id] as const,
  },
  proposals: {
    all: ['proposals'] as const,
    mine: (params: object) => ['proposals', 'mine', params] as const,
    forGig: (gigId: string) => ['proposals', 'gig', gigId] as const,
    detail: (id: string) => ['proposals', 'detail', id] as const,
  },
  search: {
    categories: ['search', 'categories'] as const,
    trending: ['search', 'trending'] as const,
    freelancers: (filters: FreelancerFilters) => ['search', 'freelancers', filters] as const,
    gigs: (filters: GigFilters) => ['search', 'gigs', filters] as const,
    suggestions: (q: string) => ['search', 'suggestions', q] as const,
  },
  users: {
    me: ['users', 'me'] as const,
    freelancer: (id: string) => ['users', 'freelancer', id] as const,
    client: (id: string) => ['users', 'client', id] as const,
  },
  reviews: {
    all: ['reviews'] as const,
    forUser: (id: string) => ['reviews', 'user', id] as const,
    breakdown: (id: string) => ['reviews', 'breakdown', id] as const,
  },
  payments: {
    all: ['payments'] as const,
    history: (params: object) => ['payments', 'history', params] as const,
    summary: ['payments', 'summary'] as const,
    config: ['payments', 'config'] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    list: (params: object) => ['notifications', 'list', params] as const,
    unread: ['notifications', 'unread'] as const,
  },
  chat: {
    conversations: ['chat', 'conversations'] as const,
    messages: (id: string) => ['chat', 'messages', id] as const,
  },
  ai: {
    matches: (gigId: string) => ['ai', 'matches', gigId] as const,
    recommendations: ['ai', 'recommendations'] as const,
  },
  analytics: {
    freelancer: (period: string) => ['analytics', 'freelancer', period] as const,
    client: (period: string) => ['analytics', 'client', period] as const,
  },
  disputes: {
    all: ['disputes'] as const,
    list: (params: object) => ['disputes', 'list', params] as const,
    detail: (id: string) => ['disputes', 'detail', id] as const,
  },
  admin: {
    all: ['admin'] as const,
    stats: ['admin', 'stats'] as const,
    analytics: (period: string) => ['admin', 'analytics', period] as const,
    users: (params: object) => ['admin', 'users', params] as const,
    user: (id: string) => ['admin', 'user', id] as const,
    pendingGigs: (params: object) => ['admin', 'pendingGigs', params] as const,
    payments: (params: object) => ['admin', 'payments', params] as const,
    fraud: ['admin', 'fraud'] as const,
    logs: (params: object) => ['admin', 'logs', params] as const,
  },
};
