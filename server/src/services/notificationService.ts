import Notification from '../models/Notification';
import { NotificationType } from '../types';
import { getIO } from '../config/socket';

class NotificationService {
  async create(data: {
    recipient: string;
    sender?: string;
    type: NotificationType;
    title: string;
    message: string;
    data?: Record<string, unknown>;
    link?: string;
  }): Promise<void> {
    try {
      const notification = await Notification.create(data);

      // Send real-time notification via Socket.IO
      try {
        const io = getIO();
        io.to(`user:${data.recipient}`).emit('notification', {
          notification: notification.toJSON(),
        });
      } catch {
        // Socket might not be initialized in test environment
      }
    } catch (error) {
      console.error('Failed to create notification:', error);
    }
  }

  async notifyProposalReceived(
    clientId: string,
    freelancerId: string,
    gigTitle: string,
    gigId: string
  ): Promise<void> {
    await this.create({
      recipient: clientId,
      sender: freelancerId,
      type: NotificationType.PROPOSAL_RECEIVED,
      title: 'New Proposal Received',
      message: `A new proposal has been submitted for "${gigTitle}"`,
      data: { gigId },
      link: `/client/gigs/${gigId}/proposals`,
    });
  }

  async notifyProposalAccepted(
    freelancerId: string,
    clientId: string,
    gigTitle: string,
    gigId: string
  ): Promise<void> {
    await this.create({
      recipient: freelancerId,
      sender: clientId,
      type: NotificationType.PROPOSAL_ACCEPTED,
      title: 'Proposal Accepted!',
      message: `Your proposal for "${gigTitle}" has been accepted`,
      data: { gigId },
      link: `/projects/${gigId}`,
    });
  }

  async notifyProposalRejected(
    freelancerId: string,
    clientId: string,
    gigTitle: string,
    gigId: string
  ): Promise<void> {
    await this.create({
      recipient: freelancerId,
      sender: clientId,
      type: NotificationType.PROPOSAL_REJECTED,
      title: 'Proposal Update',
      message: `Your proposal for "${gigTitle}" was not selected`,
      data: { gigId },
      link: '/freelancer/proposals',
    });
  }

  async notifyGigAwarded(
    freelancerId: string,
    clientId: string,
    gigTitle: string,
    gigId: string
  ): Promise<void> {
    await this.create({
      recipient: freelancerId,
      sender: clientId,
      type: NotificationType.GIG_AWARDED,
      title: 'Gig Awarded!',
      message: `You have been awarded the gig "${gigTitle}"`,
      data: { gigId },
      link: `/projects/${gigId}`,
    });
  }

  async notifyPaymentEscrow(
    freelancerId: string,
    clientId: string,
    amount: number,
    gigId: string
  ): Promise<void> {
    await this.create({
      recipient: freelancerId,
      sender: clientId,
      type: NotificationType.PAYMENT_ESCROW,
      title: 'Payment in Escrow',
      message: `A payment of ₹${amount} has been placed in escrow`,
      data: { gigId, amount },
      link: `/payments`,
    });
  }

  async notifyPaymentReleased(
    freelancerId: string,
    amount: number,
    gigId: string
  ): Promise<void> {
    await this.create({
      recipient: freelancerId,
      type: NotificationType.PAYMENT_RELEASED,
      title: 'Payment Released!',
      message: `A payment of ₹${amount} has been released to you`,
      data: { gigId, amount },
      link: `/payments`,
    });
  }

  async notifyPaymentReceived(
    clientId: string,
    amount: number,
    gigId: string
  ): Promise<void> {
    await this.create({
      recipient: clientId,
      type: NotificationType.PAYMENT_RECEIVED,
      title: 'Payment Confirmed',
      message: `Your payment of ₹${amount} has been received`,
      data: { gigId, amount },
      link: `/payments`,
    });
  }

  async notifyReviewReceived(
    revieweeId: string,
    reviewerId: string,
    rating: number,
    gigTitle: string,
    gigId: string
  ): Promise<void> {
    await this.create({
      recipient: revieweeId,
      sender: reviewerId,
      type: NotificationType.REVIEW_RECEIVED,
      title: 'New Review Received',
      message: `You received a ${rating}-star review for "${gigTitle}"`,
      data: { gigId, rating },
      link: `/reviews`,
    });
  }

  async notifyMessageReceived(
    recipientId: string,
    senderId: string,
    senderName: string,
    conversationId: string
  ): Promise<void> {
    await this.create({
      recipient: recipientId,
      sender: senderId,
      type: NotificationType.MESSAGE_RECEIVED,
      title: 'New Message',
      message: `You have a new message from ${senderName}`,
      data: { conversationId },
      link: `/chat?c=${conversationId}`,
    });
  }

  async notifyDisputeOpened(
    userId: string,
    disputeTitle: string,
    disputeId: string
  ): Promise<void> {
    await this.create({
      recipient: userId,
      type: NotificationType.DISPUTE_OPENED,
      title: 'Dispute Opened',
      message: `A dispute has been opened: "${disputeTitle}"`,
      data: { disputeId },
      link: `/disputes/${disputeId}`,
    });
  }

  async notifyDisputeResolved(
    userId: string,
    disputeTitle: string,
    disputeId: string,
    resolution: string
  ): Promise<void> {
    await this.create({
      recipient: userId,
      type: NotificationType.DISPUTE_RESOLVED,
      title: 'Dispute Resolved',
      message: `The dispute "${disputeTitle}" has been resolved: ${resolution}`,
      data: { disputeId },
      link: `/disputes/${disputeId}`,
    });
  }

  async notifyGigCompleted(
    clientId: string,
    gigTitle: string,
    gigId: string
  ): Promise<void> {
    await this.create({
      recipient: clientId,
      type: NotificationType.GIG_COMPLETED,
      title: 'Gig Completed',
      message: `The gig "${gigTitle}" has been marked as completed`,
      data: { gigId },
      link: `/projects/${gigId}`,
    });
  }

  async notifyMilestoneCompleted(
    clientId: string,
    freelancerId: string,
    milestoneTitle: string,
    gigId: string
  ): Promise<void> {
    await this.create({
      recipient: clientId,
      sender: freelancerId,
      type: NotificationType.MILESTONE_COMPLETED,
      title: 'Milestone Completed',
      message: `The milestone "${milestoneTitle}" has been completed`,
      data: { gigId },
      link: `/projects/${gigId}`,
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return Notification.countDocuments({
      recipient: userId,
      isRead: false,
    });
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: userId },
      { isRead: true, readAt: new Date() }
    );
  }

  async markAllAsRead(userId: string): Promise<void> {
    await Notification.updateMany(
      { recipient: userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );
  }
}

export default new NotificationService();
