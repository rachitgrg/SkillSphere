import { sendEmail } from '../utils/sendEmail';
import User from '../models/User';

class EmailService {
  async sendProposalNotification(
    clientId: string,
    freelancerName: string,
    gigTitle: string
  ): Promise<void> {
    try {
      const client = await User.findById(clientId);
      if (!client) return;

      await sendEmail({
        to: client.email,
        subject: `New Proposal Received - ${gigTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">New Proposal Received!</h2>
            <p><strong>${freelancerName}</strong> has submitted a proposal for your gig:</p>
            <h3>${gigTitle}</h3>
            <a href="${process.env.CLIENT_URL}/gigs" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">
              View Proposal
            </a>
          </div>
        `,
      });
    } catch (error) {
      console.error('Failed to send proposal notification email:', error);
    }
  }

  async sendProposalStatusEmail(
    freelancerId: string,
    gigTitle: string,
    status: string
  ): Promise<void> {
    try {
      const freelancer = await User.findById(freelancerId);
      if (!freelancer) return;

      const statusMessages: Record<string, string> = {
        accepted: 'Congratulations! Your proposal has been accepted.',
        rejected: 'Unfortunately, your proposal was not selected this time.',
        negotiating: 'The client would like to negotiate the terms of your proposal.',
      };

      await sendEmail({
        to: freelancer.email,
        subject: `Proposal ${status} - ${gigTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Proposal Update</h2>
            <p>${statusMessages[status] || `Your proposal status has been updated to: ${status}`}</p>
            <h3>${gigTitle}</h3>
            <a href="${process.env.CLIENT_URL}/proposals" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">
              View Details
            </a>
          </div>
        `,
      });
    } catch (error) {
      console.error('Failed to send proposal status email:', error);
    }
  }

  async sendPaymentNotification(
    userId: string,
    amount: number,
    type: 'received' | 'released' | 'escrow' | 'refunded',
    gigTitle: string
  ): Promise<void> {
    try {
      const user = await User.findById(userId);
      if (!user) return;

      const typeMessages: Record<string, string> = {
        received: `A payment of ₹${amount} has been received for "${gigTitle}".`,
        released: `A payment of ₹${amount} has been released for "${gigTitle}".`,
        escrow: `A payment of ₹${amount} has been placed in escrow for "${gigTitle}".`,
        refunded: `A refund of ₹${amount} has been processed for "${gigTitle}".`,
      };

      await sendEmail({
        to: user.email,
        subject: `Payment ${type} - SkillSphere`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Payment Update</h2>
            <p>${typeMessages[type]}</p>
            <a href="${process.env.CLIENT_URL}/payments" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">
              View Payments
            </a>
          </div>
        `,
      });
    } catch (error) {
      console.error('Failed to send payment notification email:', error);
    }
  }

  async sendDisputeNotification(
    userId: string,
    disputeTitle: string,
    message: string
  ): Promise<void> {
    try {
      const user = await User.findById(userId);
      if (!user) return;

      await sendEmail({
        to: user.email,
        subject: `Dispute Update: ${disputeTitle} - SkillSphere`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626;">Dispute Notification</h2>
            <h3>${disputeTitle}</h3>
            <p>${message}</p>
            <a href="${process.env.CLIENT_URL}/disputes" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">
              View Dispute
            </a>
          </div>
        `,
      });
    } catch (error) {
      console.error('Failed to send dispute notification email:', error);
    }
  }

  async sendReviewNotification(
    userId: string,
    reviewerName: string,
    rating: number,
    gigTitle: string
  ): Promise<void> {
    try {
      const user = await User.findById(userId);
      if (!user) return;

      await sendEmail({
        to: user.email,
        subject: `New Review Received - SkillSphere`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">New Review</h2>
            <p><strong>${reviewerName}</strong> left a ${rating}-star review for "${gigTitle}".</p>
            <a href="${process.env.CLIENT_URL}/reviews" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">
              View Review
            </a>
          </div>
        `,
      });
    } catch (error) {
      console.error('Failed to send review notification email:', error);
    }
  }

  async sendWelcomeEmail(email: string, firstName: string): Promise<void> {
    try {
      await sendEmail({
        to: email,
        subject: 'Welcome to SkillSphere!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Welcome, ${firstName}!</h2>
            <p>Thank you for joining SkillSphere. We're excited to have you on board!</p>
            <p>Here's what you can do next:</p>
            <ul>
              <li>Complete your profile to stand out</li>
              <li>Browse available gigs</li>
              <li>Connect with talented professionals</li>
            </ul>
            <a href="${process.env.CLIENT_URL}/dashboard" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">
              Get Started
            </a>
          </div>
        `,
      });
    } catch (error) {
      console.error('Failed to send welcome email:', error);
    }
  }
}

export default new EmailService();
