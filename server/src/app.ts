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
import reviewRoutes from './routes/reviewRoutes';
import notificationRoutes from './routes/notificationRoutes';
import adminRoutes from './routes/adminRoutes';
import disputeRoutes from './routes/disputeRoutes';
import searchRoutes from './routes/searchRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import aiRoutes from './routes/aiRoutes';
import { env } from './config/env';

const app: Application = express();

// Security Middlewares
app.use(helmet());
app.use(cors({
  origin: env.CLIENT_URL,
  credentials: true
}));
app.use(mongoSanitize());

// Utilities
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
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

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'success', message: 'Server is running' });
});

// Error Handling
app.use(notFound);
app.use(errorHandler);

export default app;
