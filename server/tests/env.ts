// Runs before any module is imported in a test file. env.ts skips the real .env
// when NODE_ENV=test, so tests can never reach the Atlas database.
process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://placeholder-replaced-by-memory-server';
process.env.JWT_SECRET = 'test-access-secret-0123456789abcdef0123456789';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-0123456789abcdef01234567';
process.env.CLIENT_URL = 'http://localhost:5173';
