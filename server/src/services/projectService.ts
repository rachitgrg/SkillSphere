import { HydratedDocument, Types } from 'mongoose';
import Gig from '../models/Gig';
import Payment from '../models/Payment';
import ClientProfile from '../models/ClientProfile';
import FreelancerProfile from '../models/FreelancerProfile';
import notificationService from './notificationService';
import paymentService from './paymentService';
import reputationService from './reputationService';
import { StoredFile } from './uploadService';
import { env } from '../config/env';
import { GigStatus, IGig, IMilestone, IUser, MilestoneStatus, NotificationType, PaymentStatus, UserRole } from '../types';
import { HttpError } from '../utils/httpError';
import { formatCurrency } from '../utils/helpers';

type GigDoc = HydratedDocument<IGig>;
export type Party = 'client' | 'freelancer' | 'admin';

const DAY_MS = 86_400_000;
const toAttachments = (files: StoredFile[]) => files.map(({ url, publicId, name, size, mimeType }) => ({ url, publicId, name, size, mimeType }));

/**
 * Completion figures for the progress bar:
 *  - paidPercent:     approved milestone amount / total milestone amount
 *  - progressPercent: amount-weighted progress, approved milestones count 100%, others their `percent`
 */
export const computeProgress = (milestones: Pick<IMilestone, 'amount' | 'status' | 'percent'>[]) => {
  const total = milestones.reduce((s, m) => s + m.amount, 0);
  if (!total) return { total: 0, approvedAmount: 0, paidPercent: 0, progressPercent: 0 };
  const approvedAmount = milestones.filter((m) => m.status === MilestoneStatus.APPROVED).reduce((s, m) => s + m.amount, 0);
  const weighted = milestones.reduce(
    (s, m) => s + m.amount * (m.status === MilestoneStatus.APPROVED ? 100 : m.status === MilestoneStatus.SUBMITTED ? Math.max(m.percent ?? 0, 90) : m.percent ?? 0),
    0
  );
  return {
    total,
    approvedAmount,
    paidPercent: Math.round((approvedAmount / total) * 100),
    progressPercent: Math.round(weighted / total),
  };
};

class ProjectService {
  /** Loads a gig the user takes part in (client, hired freelancer or admin) once work has started. */
  async loadForParty(gigId: string, user: Pick<IUser, '_id' | 'role'>): Promise<{ gig: GigDoc; party: Party }> {
    if (!Types.ObjectId.isValid(gigId)) throw new HttpError(404, 'Project not found');
    const gig = await Gig.findById(gigId);
    if (!gig) throw new HttpError(404, 'Project not found');
    const id = user._id.toString();
    const party: Party | null =
      gig.client.toString() === id ? 'client' : gig.selectedFreelancer?.toString() === id ? 'freelancer' : user.role === UserRole.ADMIN ? 'admin' : null;
    if (!party) throw new HttpError(404, 'Project not found');
    if (![GigStatus.IN_PROGRESS, GigStatus.COMPLETED, GigStatus.CANCELLED].includes(gig.status)) {
      throw new HttpError(409, 'Nobody has been hired for this gig yet');
    }
    return { gig, party };
  }

  private milestone(gig: GigDoc, milestoneId: string) {
    const m = gig.milestones.find((x) => x._id?.toString() === milestoneId);
    if (!m) throw new HttpError(404, 'Milestone not found');
    return m;
  }

  private assertActive(gig: GigDoc) {
    if (gig.status !== GigStatus.IN_PROGRESS) throw new HttpError(409, `This project is ${gig.status.replace('_', ' ')}`);
  }

  private notifyOther(gig: Pick<IGig, '_id' | 'client' | 'selectedFreelancer'>, to: 'client' | 'freelancer', title: string, message: string, type = NotificationType.MILESTONE_UPDATE) {
    const recipient = to === 'client' ? gig.client : gig.selectedFreelancer;
    if (!recipient) return Promise.resolve();
    return notificationService.create({
      recipient: recipient.toString(),
      type,
      title,
      message,
      data: { gigId: gig._id.toString() },
      link: `/projects/${gig._id}`,
      category: 'projects',
    });
  }

  /** Freelancer starts a funded milestone (escrow must hold the money). */
  async start(gig: GigDoc, milestoneId: string) {
    this.assertActive(gig);
    const m = this.milestone(gig, milestoneId);
    if (m.status !== MilestoneStatus.FUNDED) {
      throw new HttpError(409, m.status === MilestoneStatus.PENDING ? 'The client has not funded this milestone yet' : `Milestone is already ${m.status.replace('_', ' ')}`);
    }
    m.status = MilestoneStatus.IN_PROGRESS;
    m.startedAt = new Date();
    await gig.save();
    await this.notifyOther(gig, 'client', 'Work started', `Work on "${m.title}" has started.`);
    return gig;
  }

  /** Freelancer's own estimate of progress on an active milestone. */
  async setPercent(gig: GigDoc, milestoneId: string, percent: number) {
    this.assertActive(gig);
    const m = this.milestone(gig, milestoneId);
    if (![MilestoneStatus.IN_PROGRESS, MilestoneStatus.CHANGES_REQUESTED].includes(m.status)) {
      throw new HttpError(409, 'Progress can only be updated while the milestone is being worked on');
    }
    m.percent = percent;
    await gig.save();
    return gig;
  }

  /** Freelancer delivers a milestone (note + files); the client then approves or asks for changes. */
  async submit(gig: GigDoc, milestoneId: string, note: string | undefined, files: StoredFile[]) {
    this.assertActive(gig);
    const m = this.milestone(gig, milestoneId);
    if (![MilestoneStatus.IN_PROGRESS, MilestoneStatus.CHANGES_REQUESTED].includes(m.status)) {
      throw new HttpError(409, m.status === MilestoneStatus.FUNDED ? 'Start the milestone before submitting it' : `Milestone is ${m.status.replace('_', ' ')}`);
    }
    m.status = MilestoneStatus.SUBMITTED;
    m.submittedAt = new Date();
    m.percent = 100;
    m.submission = { note, attachments: toAttachments(files) };
    await gig.save();
    await this.notifyOther(
      gig,
      'client',
      'Milestone submitted',
      `"${m.title}" was delivered. Review it within ${env.AUTO_RELEASE_DAYS} days, or escrow is released automatically.`
    );
    return gig;
  }

  async requestChanges(gig: GigDoc, milestoneId: string, note: string) {
    this.assertActive(gig);
    const m = this.milestone(gig, milestoneId);
    if (m.status !== MilestoneStatus.SUBMITTED) throw new HttpError(409, 'Only submitted milestones can be sent back');
    m.status = MilestoneStatus.CHANGES_REQUESTED;
    m.changeRequest = { note, requestedAt: new Date() };
    await gig.save();
    await this.notifyOther(gig, 'freelancer', 'Changes requested', `The client asked for changes on "${m.title}": ${note}`);
    return gig;
  }

  /**
   * Approves a submitted milestone and releases its escrow. `auto` marks the automatic release after
   * AUTO_RELEASE_DAYS. Approving the last milestone completes the gig.
   */
  async approve(gig: GigDoc, milestoneId: string, { auto = false } = {}) {
    this.assertActive(gig);
    const m = this.milestone(gig, milestoneId);
    if (m.status !== MilestoneStatus.SUBMITTED) throw new HttpError(409, 'Only submitted milestones can be approved');

    const payment = await Payment.findOne({ gig: gig._id, milestone: m._id, status: { $in: [PaymentStatus.ESCROW, PaymentStatus.DISPUTED] } });
    if (payment?.status === PaymentStatus.DISPUTED) throw new HttpError(409, 'This milestone is under dispute; an admin will resolve it');

    // Guarded transition so a double click (or the auto-release job racing the client) approves once.
    const claimed = await Gig.findOneAndUpdate(
      { _id: gig._id, milestones: { $elemMatch: { _id: m._id, status: MilestoneStatus.SUBMITTED } } },
      { $set: { 'milestones.$.status': MilestoneStatus.APPROVED, 'milestones.$.approvedAt': new Date(), 'milestones.$.completedAt': new Date(), 'milestones.$.percent': 100 } },
      { returnDocument: 'after' }
    );
    if (!claimed) throw new HttpError(409, 'Milestone was already handled');

    if (payment) await paymentService.releasePayment(payment._id);
    await this.notifyOther(
      claimed,
      'freelancer',
      auto ? 'Milestone auto-approved' : 'Milestone approved',
      auto
        ? `"${m.title}" was approved automatically after ${env.AUTO_RELEASE_DAYS} days without a response.`
        : `"${m.title}" was approved${payment ? ` and ${formatCurrency(payment.freelancerAmount)} released` : ''}.`,
      NotificationType.MILESTONE_COMPLETED
    );
    if (auto) await this.notifyOther(claimed, 'client', 'Milestone auto-approved', `"${m.title}" was approved automatically and its escrow released.`);

    if (claimed.milestones.every((x) => x.status === MilestoneStatus.APPROVED)) await this.complete(claimed);
    return (await Gig.findById(gig._id))!;
  }

  /**
   * Completes the gig: requires every milestone approved and no money still held; releases remaining
   * escrow for gigs without milestones. Updates counters and asks both parties for a review.
   */
  async complete(gig: GigDoc) {
    this.assertActive(gig);
    if (gig.milestones.some((m) => m.status !== MilestoneStatus.APPROVED)) {
      throw new HttpError(409, 'Approve every milestone before completing the project');
    }
    if (await Payment.exists({ gig: gig._id, status: PaymentStatus.DISPUTED })) {
      throw new HttpError(409, 'Resolve the open dispute before completing the project');
    }
    const done = await Gig.findOneAndUpdate(
      { _id: gig._id, status: GigStatus.IN_PROGRESS },
      { $set: { status: GigStatus.COMPLETED, completedAt: new Date() } },
      { returnDocument: 'after' }
    );
    if (!done) throw new HttpError(409, 'Project is already closed');

    const held = await Payment.find({ gig: gig._id, status: PaymentStatus.ESCROW }).select('_id');
    for (const p of held) await paymentService.releasePayment(p._id);

    await Promise.all([
      ClientProfile.updateOne({ user: done.client, activeGigs: { $gt: 0 } }, { $inc: { activeGigs: -1 } }),
      ClientProfile.updateOne({ user: done.client }, { $inc: { completedGigs: 1 } }),
      FreelancerProfile.updateOne({ user: done.selectedFreelancer }, { $inc: { completedGigs: 1 } }),
    ]);
    await Promise.all([done.client, done.selectedFreelancer!].map((id) => reputationService.updateUserReputation(id)));
    await Promise.all(
      (['client', 'freelancer'] as const).map((to) =>
        notificationService.create({
          recipient: (to === 'client' ? done.client : done.selectedFreelancer!).toString(),
          type: NotificationType.GIG_COMPLETED,
          title: 'Project completed',
          message: `"${done.title}" is complete. Leave a review to help others hire with confidence.`,
          data: { gigId: done._id.toString(), review: true },
          link: `/projects/${done._id}?review=1`,
          category: 'projects',
        })
      )
    );
    return done;
  }

  async addLog(gig: GigDoc, author: Pick<IUser, '_id'>, party: Party, message: string, milestoneId: string | undefined, files: StoredFile[]) {
    if (party === 'admin') throw new HttpError(403, 'Only the client and freelancer post progress logs');
    if (milestoneId) this.milestone(gig, milestoneId);
    gig.progressLogs.push({
      author: author._id,
      message,
      milestone: milestoneId ? new Types.ObjectId(milestoneId) : undefined,
      attachments: toAttachments(files),
    } as never);
    await gig.save();
    await this.notifyOther(
      gig,
      party === 'client' ? 'freelancer' : 'client',
      'Project update',
      `New update on "${gig.title}": ${message.slice(0, 140)}`,
      NotificationType.PROGRESS_UPDATE
    );
    return gig.progressLogs[gig.progressLogs.length - 1];
  }

  /** Approves milestones submitted more than AUTO_RELEASE_DAYS ago. Returns how many were approved. */
  async autoReleaseOverdue(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - env.AUTO_RELEASE_DAYS * DAY_MS);
    const gigs = await Gig.find({
      status: GigStatus.IN_PROGRESS,
      milestones: { $elemMatch: { status: MilestoneStatus.SUBMITTED, submittedAt: { $lte: cutoff } } },
    });
    let count = 0;
    for (const gig of gigs) {
      for (const m of gig.milestones.filter((x) => x.status === MilestoneStatus.SUBMITTED && x.submittedAt && x.submittedAt <= cutoff)) {
        try {
          const fresh = await Gig.findById(gig._id);
          if (fresh) await this.approve(fresh, m._id!.toString(), { auto: true });
          count += 1;
        } catch (error) {
          // Disputed or already handled: skip, the next run re-checks.
          console.warn(`Auto-release skipped for milestone ${m._id}:`, (error as Error).message);
        }
      }
    }
    return count;
  }

  /**
   * Daily deadline reminders: milestones due within 48 h and overdue ones that are not yet approved.
   * Each reminder key is stored in `remindersSent` so it is sent once.
   */
  async sendDeadlineReminders(now = new Date()): Promise<number> {
    const soon = new Date(now.getTime() + 2 * DAY_MS);
    const gigs = await Gig.find({
      status: GigStatus.IN_PROGRESS,
      milestones: { $elemMatch: { status: { $ne: MilestoneStatus.APPROVED }, dueDate: { $lte: soon } } },
    });
    let sent = 0;
    for (const gig of gigs) {
      for (const m of gig.milestones) {
        if (m.status === MilestoneStatus.APPROVED || m.dueDate > soon) continue;
        const key = m.dueDate < now ? 'overdue' : 'due-48h';
        if (m.remindersSent?.includes(key)) continue;
        // Record first: a crash after this line skips one reminder rather than sending it twice.
        const res = await Gig.updateOne(
          { _id: gig._id, milestones: { $elemMatch: { _id: m._id, remindersSent: { $ne: key } } } },
          { $addToSet: { 'milestones.$.remindersSent': key } }
        );
        if (!res.modifiedCount) continue;
        const text = key === 'overdue' ? `"${m.title}" on "${gig.title}" is overdue.` : `"${m.title}" on "${gig.title}" is due within 48 hours.`;
        await Promise.all(
          (['client', 'freelancer'] as const).map((to) =>
            this.notifyOther(gig, to, key === 'overdue' ? 'Milestone overdue' : 'Deadline approaching', text, NotificationType.DEADLINE_REMINDER)
          )
        );
        sent += 1;
      }
    }
    return sent;
  }
}

export default new ProjectService();
