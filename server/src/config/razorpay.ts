import Razorpay from 'razorpay';
import { env, features } from './env';

let instance: Razorpay | null = null;

/**
 * Returns a Razorpay client, or null when keys are not configured.
 * Payment routes must answer 503 "Payments not configured" when this is null.
 */
export const getRazorpay = (): Razorpay | null => {
  if (!features.razorpay) return null;
  if (!instance) {
    instance = new Razorpay({ key_id: env.RAZORPAY_KEY_ID!, key_secret: env.RAZORPAY_KEY_SECRET! });
  }
  return instance;
};
