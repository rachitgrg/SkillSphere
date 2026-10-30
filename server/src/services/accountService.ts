import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import ClientProfile from '../models/ClientProfile';
import FreelancerProfile from '../models/FreelancerProfile';
import User from '../models/User';
import sessionService from './sessionService';
import { env } from '../config/env';
import { IUser, UserRole } from '../types';
import { decrypt, encrypt, randomToken, sha256 } from '../utils/crypto';
import { sendPasswordResetEmail, sendVerificationEmail } from '../utils/sendEmail';

const DAY = 86_400_000;
const TWO_FA_PURPOSE = '2fa';
const BACKUP_CODE_COUNT = 8;
/** Separate key so a challenge token can never be used as an access token. */
const challengeSecret = () => `${env.JWT_SECRET}:2fa-challenge`;

// Accept the previous/next 30s step to tolerate small clock drift.
authenticator.options = { window: 1 };

class AccountService {
  /** Creates the empty client/freelancer profile that goes with a role. */
  async createRoleProfile(user: IUser): Promise<void> {
    if (user.role === UserRole.CLIENT) {
      await ClientProfile.updateOne({ user: user._id }, { $setOnInsert: { user: user._id } }, { upsert: true });
    } else if (user.role === UserRole.FREELANCER) {
      await FreelancerProfile.updateOne(
        { user: user._id },
        { $setOnInsert: { user: user._id, title: 'New Freelancer', headline: 'Ready to work', responseTime: 24 } },
        { upsert: true }
      );
    }
  }

  // ───────────── Email verification ─────────────

  /** Stores a hashed 24h token and emails the link. Email failures are logged, not thrown. */
  async sendEmailVerification(user: IUser): Promise<void> {
    const token = randomToken();
    await User.updateOne(
      { _id: user._id },
      { emailVerificationToken: sha256(token), emailVerificationExpires: new Date(Date.now() + DAY) }
    );
    try {
      await sendVerificationEmail(user.email, token);
    } catch (error) {
      console.error('[email] verification email failed:', error);
    }
  }

  async verifyEmail(token: string): Promise<IUser | null> {
    return User.findOneAndUpdate(
      { emailVerificationToken: sha256(token), emailVerificationExpires: { $gt: new Date() } },
      { $set: { isVerified: true }, $unset: { emailVerificationToken: 1, emailVerificationExpires: 1 } },
      { returnDocument: 'after' }
    );
  }

  // ───────────── Password reset ─────────────

  /** Always resolves (no user enumeration); emails a 1h link when the account exists. */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await User.findOne({ email, isActive: true });
    if (!user) return;
    const token = randomToken();
    await User.updateOne(
      { _id: user._id },
      { passwordResetToken: sha256(token), passwordResetExpires: new Date(Date.now() + DAY / 24) }
    );
    try {
      await sendPasswordResetEmail(user.email, token);
    } catch (error) {
      console.error('[email] password reset email failed:', error);
    }
  }

  /** Sets a new password and revokes every existing session. */
  async resetPassword(token: string, password: string): Promise<boolean> {
    const user = await User.findOne({ passwordResetToken: sha256(token), passwordResetExpires: { $gt: new Date() } });
    if (!user) return false;
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    await sessionService.revokeAll(user._id);
    return true;
  }

  // ───────────── Two-factor (TOTP) ─────────────

  /** Generates a new (not yet active) secret and the QR code to scan. */
  async setupTwoFactor(user: IUser): Promise<{ qrCode: string; secret: string; otpauthUrl: string }> {
    const secret = authenticator.generateSecret();
    await User.updateOne({ _id: user._id }, { twoFactorSecret: encrypt(secret), twoFactorEnabled: false });
    const otpauthUrl = authenticator.keyuri(user.email, 'SkillSphere', secret);
    return { qrCode: await QRCode.toDataURL(otpauthUrl), secret, otpauthUrl };
  }

  private async secretOf(userId: unknown): Promise<string | null> {
    const user = await User.findById(userId).select('+twoFactorSecret');
    return user?.twoFactorSecret ? decrypt(user.twoFactorSecret) : null;
  }

  /** Activates 2FA after the first valid code and returns one-time backup codes (shown once). */
  async enableTwoFactor(user: IUser, code: string): Promise<string[] | null> {
    const secret = await this.secretOf(user._id);
    const step = secret ? this.timeStepOf(code, secret) : null;
    if (step === null) return null;
    const backupCodes = Array.from({ length: BACKUP_CODE_COUNT }, () => randomToken(5));
    await User.updateOne(
      { _id: user._id },
      { twoFactorEnabled: true, twoFactorBackupCodes: backupCodes.map(sha256), twoFactorLastStep: step } // the setup code can't log in
    );
    return backupCodes;
  }

  async disableTwoFactor(user: IUser): Promise<void> {
    await User.updateOne(
      { _id: user._id },
      { $set: { twoFactorEnabled: false }, $unset: { twoFactorSecret: 1, twoFactorBackupCodes: 1, twoFactorLastStep: 1 } }
    );
  }

  /** The 30-second time step a valid TOTP code belongs to (within the ±1 step window), or null. */
  private timeStepOf(code: string, secret: string): number | null {
    const delta = authenticator.checkDelta(code, secret);
    if (delta === null) return null;
    return Math.floor(Date.now() / 1000 / authenticator.allOptions().step) + delta;
  }

  /**
   * Accepts a TOTP code once (a code, or any older one, can't be replayed: its time step must be
   * later than the last one used, checked and recorded atomically), or consumes a backup code.
   */
  async checkSecondFactor(userId: string, code: string): Promise<boolean> {
    const normalized = code.replace(/\s/g, '');
    const secret = await this.secretOf(userId);
    const step = secret && /^\d{6}$/.test(normalized) ? this.timeStepOf(normalized, secret) : null;
    if (step !== null) {
      const { modifiedCount } = await User.updateOne(
        { _id: userId, $or: [{ twoFactorLastStep: { $exists: false } }, { twoFactorLastStep: { $lt: step } }] },
        { $set: { twoFactorLastStep: step } }
      );
      return modifiedCount === 1;
    }
    const { modifiedCount } = await User.updateOne(
      { _id: userId, twoFactorBackupCodes: sha256(normalized.toLowerCase()) },
      { $pull: { twoFactorBackupCodes: sha256(normalized.toLowerCase()) } }
    );
    return modifiedCount === 1;
  }

  /** Short-lived token proving the password step passed; only good for POST /auth/2fa/verify. */
  issueTwoFactorChallenge(user: IUser): string {
    return jwt.sign({ id: user._id.toString(), purpose: TWO_FA_PURPOSE }, challengeSecret(), { expiresIn: '5m' });
  }

  readTwoFactorChallenge(token: string): string | null {
    try {
      const payload = jwt.verify(token, challengeSecret()) as { id?: string; purpose?: string };
      return payload.purpose === TWO_FA_PURPOSE && payload.id ? payload.id : null;
    } catch {
      return null;
    }
  }
}

export default new AccountService();
