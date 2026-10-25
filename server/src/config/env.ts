import path from 'path';
import dotenv from 'dotenv';
import { z } from 'zod';

// Load the root .env (server/src/config → ../../../.env; same depth from dist/config).
// Tests never read .env so they can't accidentally reach the real database.
if (process.env.NODE_ENV !== 'test') {
  dotenv.config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });
}

// Values copied verbatim from .env.example mean "not configured".
const PLACEHOLDER = /^(your_|<)|_here$/i;

/** Optional string: empty or placeholder values become undefined. */
const optionalString = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() !== '' && !PLACEHOLDER.test(v.trim()) ? v.trim() : undefined),
  z.string().optional()
);

const booleanFlag = z.preprocess(
  (v) => (typeof v === 'string' ? ['1', 'true', 'yes'].includes(v.toLowerCase()) : v),
  z.boolean().default(false)
);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),

  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  CLIENT_URL: z.string().url('CLIENT_URL must be a URL, e.g. http://localhost:5173'),

  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  GOOGLE_CALLBACK_URL: z.string().default('http://localhost:5000/api/v1/auth/google/callback'),

  CLOUDINARY_CLOUD_NAME: optionalString,
  CLOUDINARY_API_KEY: optionalString,
  CLOUDINARY_API_SECRET: optionalString,

  RAZORPAY_KEY_ID: optionalString,
  RAZORPAY_KEY_SECRET: optionalString,
  RAZORPAY_WEBHOOK_SECRET: optionalString,

  SMTP_HOST: optionalString,
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: optionalString,
  SMTP_PASS: optionalString,
  EMAIL_FROM: optionalString,

  HF_ACCESS_TOKEN: optionalString,

  REDIS_URL: optionalString,
  USE_ATLAS_SEARCH: booleanFlag,

  ADMIN_EMAIL: optionalString,
  PLATFORM_FEE_PERCENTAGE: z.coerce.number().min(0).max(100).default(10),
});

export type Env = z.infer<typeof schema>;

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid environment configuration:\n${details}`);
}

export const env: Env = parsed.data;

// Secrets published in .env.example / docs must never run in production.
const KNOWN_PLACEHOLDER_SECRETS = new Set([
  'your_jwt_secret_key_here',
  'your_jwt_refresh_secret_here',
  'secret',
  'refresh-secret',
]);

if (env.NODE_ENV === 'production') {
  for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET'] as const) {
    if (KNOWN_PLACEHOLDER_SECRETS.has(env[key]) || PLACEHOLDER.test(env[key])) {
      throw new Error(`${key} is still a placeholder value; refusing to start in production.`);
    }
  }
  if (env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must differ in production.');
  }
}

/** Which optional integrations have credentials. Callers degrade gracefully when false. */
export const features = {
  google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  cloudinary: Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET),
  razorpay: Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET),
  smtp: Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS),
  huggingFace: Boolean(env.HF_ACCESS_TOKEN),
  redis: Boolean(env.REDIS_URL),
};

/** Logs one warning per missing integration. Called once at boot. */
export const logMissingIntegrations = (): void => {
  const messages: Record<keyof typeof features, string> = {
    google: 'Google OAuth not configured (GOOGLE_CLIENT_ID/SECRET) – Google login disabled.',
    cloudinary: 'Cloudinary not configured – file uploads return 503.',
    razorpay: 'Razorpay not configured – payment routes return 503.',
    smtp: 'SMTP not configured – emails go to an Ethereal test inbox in development.',
    huggingFace: 'HF_ACCESS_TOKEN not set – AI features use the non-AI fallback.',
    redis: 'REDIS_URL not set – using in-memory caching.',
  };
  for (const key of Object.keys(features) as (keyof typeof features)[]) {
    if (!features[key]) console.warn(`⚠️  ${messages[key]}`);
  }
};
