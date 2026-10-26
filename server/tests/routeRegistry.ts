import { Router } from 'express';
import adminRoutes from '../src/routes/adminRoutes';
import aiRoutes from '../src/routes/aiRoutes';
import analyticsRoutes from '../src/routes/analyticsRoutes';
import authRoutes from '../src/routes/authRoutes';
import chatRoutes from '../src/routes/chatRoutes';
import configRoutes from '../src/routes/configRoutes';
import disputeRoutes from '../src/routes/disputeRoutes';
import gigRoutes from '../src/routes/gigRoutes';
import notificationRoutes from '../src/routes/notificationRoutes';
import paymentRoutes from '../src/routes/paymentRoutes';
import proposalRoutes from '../src/routes/proposalRoutes';
import reviewRoutes from '../src/routes/reviewRoutes';
import searchRoutes from '../src/routes/searchRoutes';
import userRoutes from '../src/routes/userRoutes';

/** Mount points from app.ts. */
export const MOUNTS: [string, Router][] = [
  ['/api/v1/admin', adminRoutes],
  ['/api/v1/ai', aiRoutes],
  ['/api/v1/analytics', analyticsRoutes],
  ['/api/v1/auth', authRoutes],
  ['/api/v1/chat', chatRoutes],
  ['/api/v1/config', configRoutes],
  ['/api/v1/disputes', disputeRoutes],
  ['/api/v1/gigs', gigRoutes],
  ['/api/v1/notifications', notificationRoutes],
  ['/api/v1/payments', paymentRoutes],
  ['/api/v1/proposals', proposalRoutes],
  ['/api/v1/reviews', reviewRoutes],
  ['/api/v1/search', searchRoutes],
  ['/api/v1/users', userRoutes],
];

type Layer = { route?: { path: string; methods: Record<string, boolean> } };

/** Routes mounted directly on the app (outside the routers above). */
export const APP_ROUTES = ['POST /api/v1/payments/webhook'];

/** Every registered route as "METHOD /full/path/:param". */
export const registeredRoutes = (): string[] => [...APP_ROUTES, ...routerRoutes()];

const routerRoutes = (): string[] =>
  MOUNTS.flatMap(([base, router]) =>
    (router.stack as unknown as Layer[])
      .filter((layer) => layer.route)
      .flatMap((layer) =>
        Object.keys(layer.route!.methods).map((m) => `${m.toUpperCase()} ${base}${layer.route!.path}`)
      )
  );

