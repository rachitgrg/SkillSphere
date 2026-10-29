// Must be the first import: loads and validates the root .env before anything reads it.
import { env, logMissingIntegrations } from './config/env';
import http from 'http';
import mongoose from 'mongoose';
import app from './app';
import connectDB from './config/db';
import { configureCloudinary } from './config/cloudinary';
import { attachRedisAdapter, initializeSocket } from './config/socket';
import { connectRedis, disconnectRedis } from './config/redis';
import { registerChatHandlers } from './sockets/chatSocket';
import { registerCallHandlers } from './sockets/callSocket';
import embeddingService from './services/embeddingService';
import { startScheduler } from './jobs/scheduler';

logMissingIntegrations();
configureCloudinary();

// Initialize server
const server = http.createServer(app);

// Single Socket.IO instance (auth + personal rooms in config/socket.ts)
initializeSocket(server, [registerChatHandlers, registerCallHandlers]);

// Connect to Database and start server
const PORT = env.PORT;

const startServer = async () => {
  try {
    await connectDB();
    const redis = await connectRedis();
    if (redis) await attachRedisAdapter(redis);
    server.listen(PORT, () => {
      console.log(`Server running in ${env.NODE_ENV} mode on port ${PORT}`);
    });
    embeddingService.queue(() => embeddingService.backfillMissing());
    startScheduler();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

const shutdown = (code: number) => {
  server.close(() => {
    Promise.all([mongoose.disconnect(), disconnectRedis()]).finally(() => process.exit(code));
  });
  // Force exit if connections don't drain in time.
  setTimeout(() => process.exit(code), 10_000).unref();
};

// A stray rejected promise (e.g. one failed DB call) is logged, not fatal: restarting would drop
// every socket connection. A synchronous uncaught exception may leave state corrupt, so exit.
process.on('unhandledRejection', (reason: unknown) => {
  console.error('UNHANDLED REJECTION (kept running):', reason instanceof Error ? reason.stack : reason);
});

process.on('uncaughtException', (err: Error) => {
  console.error('UNCAUGHT EXCEPTION! Shutting down...', err.stack ?? err);
  process.exit(1);
});

process.on('SIGTERM', () => shutdown(0));
process.on('SIGINT', () => shutdown(0));
