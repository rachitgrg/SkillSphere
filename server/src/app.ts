import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import mongoSanitize from 'express-mongo-sanitize';
import compression from 'compression';

// Import middlewares
import { errorHandler, notFound } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiter';

// Import routes
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import gigRoutes from './routes/gigRoutes';
import proposalRoutes from './routes/proposalRoutes';
import chatRoutes from './routes/chatRoutes';
import paymentRoutes from './routes/paymentRoutes';
import { razorpayWebhook } from './controllers/paymentController';
import reviewRoutes from './routes/reviewRoutes';
import notificationRoutes from './routes/notificationRoutes';
import adminRoutes from './routes/adminRoutes';
import disputeRoutes from './routes/disputeRoutes';
import searchRoutes from './routes/searchRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import aiRoutes from './routes/aiRoutes';
import configRoutes from './routes/configRoutes';
import scheduleRoutes from './routes/scheduleRoutes';
import swaggerUi from 'swagger-ui-express';
import passport from 'passport';
import configurePassport from './config/passport';
import { buildOpenApiDocument } from './docs/openapi';
import { env } from './config/env';

const app: Application = express();
// Before the rate limiters, which key on req.ip (taken from X-Forwarded-For only for trusted hops).
app.set('trust proxy', env.TRUST_PROXY);

// Security Middlewares
// The API only returns JSON, so its CSP forbids everything; Swagger UI gets its own policy below.
// The SPA's policy (Razorpay, Cloudinary, fonts) ships with the client build (client/vite.config.ts).
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"], formAction: ["'none'"] },
    },
  })
);
app.use(cors({
  origin: env.CLIENT_URL,
  credentials: true
}));
app.use(mongoSanitize());

// Utilities
// Razorpay signs the exact bytes, so the webhook gets the raw body (before express.json).
app.post('/api/v1/payments/webhook', express.raw({ type: 'application/json', limit: '1mb' }), razorpayWebhook);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
configurePassport();
app.use(passport.initialize());
app.use(compression());

if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Rate limiting
app.use('/api', apiLimiter);

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/gigs', gigRoutes);
app.use('/api/v1/proposals', proposalRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/disputes', disputeRoutes);
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/config', configRoutes);
app.use('/api/v1/schedule', scheduleRoutes);

// API docs (OpenAPI generated from the route registry + zod validators)
const openApiDocument = buildOpenApiDocument();
app.get('/api/docs.json', (_req: Request, res: Response) => {
  res.json(openApiDocument);
});
app.use(
  '/api/docs',
  helmet.contentSecurityPolicy({
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
    },
  }),
  swaggerUi.serve,
  swaggerUi.setup(openApiDocument, { customSiteTitle: 'SkillSphere API' })
);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'success', message: 'Server is running' });
});

// Error Handling
app.use(notFound);
app.use(errorHandler);

export default app;
