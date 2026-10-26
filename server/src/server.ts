// Must be the first import: loads and validates the root .env before anything reads it.
import { env, logMissingIntegrations } from './config/env';
import http from 'http';
import mongoose from 'mongoose';
import app from './app';
import connectDB from './config/db';
import { configureCloudinary } from './config/cloudinary';
import { initializeSocket } from './config/socket';
import { registerChatHandlers } from './sockets/chatSocket';
import embeddingService from './services/embeddingService';

logMissingIntegrations();
configureCloudinary();

// Initialize server
const server = http.createServer(app);

// Single Socket.IO instance (auth + personal rooms in config/socket.ts)
initializeSocket(server, [registerChatHandlers]);

// Connect to Database and start server
const PORT = env.PORT;

const startServer = async () => {
  try {
    await connectDB();
    server.listen(PORT, () => {
      console.log(`Server running in ${env.NODE_ENV} mode on port ${PORT}`);
    });
    embeddingService.queue(() => embeddingService.backfillMissing());
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

const shutdown = (code: number) => {
  server.close(() => {
    mongoose.disconnect().finally(() => process.exit(code));
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
