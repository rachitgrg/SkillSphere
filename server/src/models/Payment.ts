import mongoose, { Schema } from 'mongoose';
import { IPayment, PaymentStatus } from '../types';
import { env } from '../config/env';

const paymentSchema = new Schema<IPayment>(
  {
    gig: {
      type: Schema.Types.ObjectId,
      ref: 'Gig',
      required: true,
    },
    milestone: {
      type: Schema.Types.ObjectId,
    },
    client: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    freelancer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    platformFee: {
      type: Number,
      required: true,
      min: 0,
    },
    freelancerAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
    },
    status: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.PENDING,
    },
    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,
    escrowedAt: Date,
    releasedAt: Date,
    refundedAt: Date,
    refundReason: String,
    // Portion refunded to the client in a split dispute resolution (amount is reduced by it).
    refundedAmount: { type: Number, min: 0 },
    description: String,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
paymentSchema.index({ gig: 1 });
paymentSchema.index({ client: 1 });
paymentSchema.index({ freelancer: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ razorpayOrderId: 1 });
paymentSchema.index({ createdAt: -1 });

// Platform fee + freelancer share, computed before validation (both fields are required).
paymentSchema.pre('validate', function () {
  if (typeof this.amount === 'number' && (this.isNew || this.isModified('amount'))) {
    const feePercentage = env.PLATFORM_FEE_PERCENTAGE;
    this.platformFee = Math.round(this.amount * (feePercentage / 100) * 100) / 100;
    this.freelancerAmount = Math.round((this.amount - this.platformFee) * 100) / 100;
  }
});

const Payment = mongoose.model<IPayment>('Payment', paymentSchema);

export default Payment;
