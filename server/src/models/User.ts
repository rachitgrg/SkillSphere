import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import { IUser, UserRole } from '../types';
import { env } from '../config/env';

/** Never serialised to API responses or socket payloads. */
const SENSITIVE_FIELDS = [
  'password',
  'refreshSessions',
  'twoFactorSecret',
  'twoFactorBackupCodes',
  'lastLoginIp',
  'passwordResetToken',
  'passwordResetExpires',
  'emailVerificationToken',
  'emailVerificationExpires',
  '__v',
] as const;

const userSchema = new Schema<IUser>(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters'],
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    avatar: {
      type: String,
      default: '',
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.FREELANCER,
    },
    phone: {
      type: String,
      trim: true,
    },
    bio: {
      type: String,
      maxlength: [500, 'Bio cannot exceed 500 characters'],
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number],
        // No empty [] default: an empty point breaks the 2dsphere index.
        default: undefined,
      },
    },
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      zipCode: String,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isBanned: {
      type: Boolean,
      default: false,
    },
    banReason: String,
    // Temporary suspensions lift automatically after this date (see utils/suspension.ts).
    suspendedUntil: Date,
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    // AES-GCM encrypted TOTP seed (utils/crypto.ts); set during setup, active once twoFactorEnabled.
    twoFactorSecret: {
      type: String,
      select: false,
    },
    // sha256 hashes of one-time backup codes.
    twoFactorBackupCodes: {
      type: [String],
      select: false,
    },
    // Per-category delivery switches (see NOTIFICATION_CATEGORIES). Message emails are opt-in.
    notificationPreferences: {
      email: {
        proposals: { type: Boolean, default: true },
        gigs: { type: Boolean, default: true },
        payments: { type: Boolean, default: true },
        reviews: { type: Boolean, default: true },
        messages: { type: Boolean, default: false },
        disputes: { type: Boolean, default: true },
        projects: { type: Boolean, default: true },
      },
      inApp: {
        proposals: { type: Boolean, default: true },
        gigs: { type: Boolean, default: true },
        payments: { type: Boolean, default: true },
        reviews: { type: Boolean, default: true },
        messages: { type: Boolean, default: true },
        disputes: { type: Boolean, default: true },
        projects: { type: Boolean, default: true },
      },
    },
    // Google sign-ups pick client/freelancer on first login.
    needsRoleSelection: { type: Boolean, default: false },
    // Used for fraud signals (same IP for reviewer and reviewee).
    lastLoginIp: { type: String, select: false },
    // One entry per signed-in device (services/sessionService.ts).
    refreshSessions: {
      type: [
        {
          _id: false,
          hash: { type: String, required: true },
          previousHash: String,
          rotatedAt: Date,
          family: { type: String, required: true },
          expiresAt: { type: Date, required: true },
          userAgent: String,
          createdAt: { type: Date, required: true },
        },
      ],
      select: false,
      default: undefined,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
    emailVerificationToken: {
      type: String,
      select: false,
    },
    emailVerificationExpires: {
      type: Date,
      select: false,
    },
    lastLogin: Date,
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        for (const key of SENSITIVE_FIELDS) delete ret[key];
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// Indexes
userSchema.index({ role: 1 });
userSchema.index({ location: '2dsphere' });
userSchema.index({ isActive: 1, isBanned: 1 });
userSchema.index({ createdAt: -1 });

// Virtual: fullName
userSchema.virtual('fullName').get(function (this: IUser) {
  return `${this.firstName} ${this.lastName}`;
});

// Pre-save: hash password
userSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) {
    return;
  }
  // Low cost under test keeps suites fast; production uses 12 rounds.
  const salt = await bcrypt.genSalt(env.NODE_ENV === 'test' ? 4 : 12);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method: compare password
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model<IUser>('User', userSchema);

export default User;
