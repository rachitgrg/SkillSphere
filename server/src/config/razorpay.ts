import Razorpay from 'razorpay';

/**
 * Returns a Razorpay instance only when real credentials are configured.
 * During development without Razorpay keys the server still starts normally;
 * payment routes will simply return a 503 if called.
 */
const getRazorpayInstance = (): Razorpay | null => {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (
    !key_id || key_id === 'your_razorpay_key_id' ||
    !key_secret || key_secret === 'your_razorpay_key_secret'
  ) {
    console.warn('⚠️  Razorpay credentials not configured – payment features disabled.');
    return null;
  }

  return new Razorpay({ key_id, key_secret });
};

const razorpayInstance = getRazorpayInstance();

export default razorpayInstance;
