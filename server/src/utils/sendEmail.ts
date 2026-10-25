import nodemailer, { Transporter } from 'nodemailer';
import { env, features } from '../config/env';
import { EmailOptions } from '../types';

let transporterPromise: Promise<Transporter> | null = null;

/**
 * SMTP when configured. Otherwise: an in-memory JSON transport under test, and an
 * Ethereal test inbox in development (the preview URL is logged for each email).
 */
const getTransporter = (): Promise<Transporter> => {
  if (!transporterPromise) {
    transporterPromise = (async () => {
      if (features.smtp) {
        return nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_PORT === 465,
          auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
        });
      }
      if (env.NODE_ENV === 'test') {
        return nodemailer.createTransport({ jsonTransport: true });
      }
      const account = await nodemailer.createTestAccount();
      console.log(`📧 Using Ethereal test inbox ${account.user} (SMTP not configured)`);
      return nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        auth: { user: account.user, pass: account.pass },
      });
    })().catch((error) => {
      transporterPromise = null; // retry on next send
      throw error;
    });
  }
  return transporterPromise;
};

export const sendEmail = async (options: EmailOptions): Promise<void> => {
  if (!features.smtp && env.NODE_ENV === 'production') {
    console.warn(`[email] SMTP not configured; skipped "${options.subject}" to ${options.to}`);
    return;
  }

  const transporter = await getTransporter();
  const info = await transporter.sendMail({
    from: env.EMAIL_FROM || `"SkillSphere" <${env.SMTP_USER || 'no-reply@skillsphere.dev'}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) console.log(`📧 Email preview (${options.subject}): ${previewUrl}`);
};

export const sendVerificationEmail = async (
  email: string,
  token: string
): Promise<void> => {
  const verifyUrl = `${env.CLIENT_URL}/verify-email?token=${token}`;

  await sendEmail({
    to: email,
    subject: 'Verify Your Email - SkillSphere',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Welcome to SkillSphere!</h2>
        <p>Please verify your email address by clicking the button below:</p>
        <a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          Verify Email
        </a>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #6b7280;">${verifyUrl}</p>
        <p>This link expires in 24 hours.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">If you didn't create an account, you can safely ignore this email.</p>
      </div>
    `,
  });
};

export const sendPasswordResetEmail = async (
  email: string,
  token: string
): Promise<void> => {
  const resetUrl = `${env.CLIENT_URL}/reset-password?token=${token}`;

  await sendEmail({
    to: email,
    subject: 'Reset Your Password - SkillSphere',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Password Reset Request</h2>
        <p>You requested a password reset. Click the button below to set a new password:</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          Reset Password
        </a>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #6b7280;">${resetUrl}</p>
        <p>This link expires in 1 hour.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
};

export const sendGigNotificationEmail = async (
  email: string,
  gigTitle: string,
  message: string
): Promise<void> => {
  await sendEmail({
    to: email,
    subject: `Gig Update: ${gigTitle} - SkillSphere`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Gig Update</h2>
        <h3>${gigTitle}</h3>
        <p>${message}</p>
        <a href="${env.CLIENT_URL}/dashboard" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          View Dashboard
        </a>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">SkillSphere Notifications</p>
      </div>
    `,
  });
};
