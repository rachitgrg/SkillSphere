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

// Handle unhandled rejections
process.on('unhandledRejection', (err: Error) => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  shutdown(1);
});

process.on('uncaughtException', (err: Error) => {
  console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});

process.on('SIGTERM', () => shutdown(0));
process.on('SIGINT', () => shutdown(0));
