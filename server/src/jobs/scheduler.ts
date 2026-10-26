import { schedule, ScheduledTask } from 'node-cron';
import { env } from '../config/env';
import paymentService from '../services/paymentService';
import projectService from '../services/projectService';

const TIMEZONE = 'Asia/Kolkata';

/** Wraps a job so a failure is logged and never crashes the server. */
const safely = (name: string, job: () => Promise<number>) => async () => {
  try {
    const count = await job();
    if (count) console.log(`[jobs] ${name}: ${count}`);
  } catch (error) {
    console.error(`[jobs] ${name} failed:`, error);
  }
};

/**
 * Background jobs (plan 4.7 / 4.14):
 *  - payouts:        every PAYOUT_INTERVAL_MINUTES, process queued (simulated) freelancer payouts
 *  - auto-release:   hourly, approve milestones submitted AUTO_RELEASE_DAYS ago and release escrow
 *  - reminders:      daily at 09:00 IST, milestones due within 48 h or overdue
 * Not started under tests; the job functions are tested directly.
 */
export const startScheduler = (): ScheduledTask[] => [
  schedule(`*/${env.PAYOUT_INTERVAL_MINUTES} * * * *`, safely('payouts processed', () => paymentService.processPayouts()), { name: 'payouts', noOverlap: true, timezone: TIMEZONE }),
  schedule('7 * * * *', safely('milestones auto-approved', () => projectService.autoReleaseOverdue()), { name: 'auto-release', noOverlap: true, timezone: TIMEZONE }),
  schedule('0 9 * * *', safely('deadline reminders sent', () => projectService.sendDeadlineReminders()), { name: 'deadline-reminders', noOverlap: true, timezone: TIMEZONE }),
];
