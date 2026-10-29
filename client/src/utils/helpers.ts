import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns';
import type { PaymentStatus } from '../types';

export const formatDate = (date: string) => {
  const parsed = parseISO(date);
  if (isToday(parsed)) return `Today at ${format(parsed, 'h:mm a')}`;
  if (isYesterday(parsed)) return `Yesterday at ${format(parsed, 'h:mm a')}`;
  return format(parsed, 'MMM d, yyyy');
};

/** Calendar date only, e.g. "25 Oct 2026". */
export const formatDay = (date: string) => format(parseISO(date), 'd MMM yyyy');

export const formatTimeAgo = (date: string) => {
  return formatDistanceToNow(parseISO(date), { addSuffix: true });
};

/** Formats money in Indian rupees by default (e.g. ₹1,42,500). */
export const formatCurrency = (amount: number, currency = 'INR') => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const getInitials = (firstName: string, lastName: string) => {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
};

/** Extracts a user-facing message from an axios/unknown error. */
export const getErrorMessage = (error: unknown, fallback = 'Something went wrong') => {
  if (typeof error === 'object' && error !== null) {
    const e = error as { response?: { data?: { message?: string } }; message?: string };
    return e.response?.data?.message || e.message || fallback;
  }
  return fallback;
};

/** Narrows a populated reference (`{ _id, ... }`) vs a bare id. */
export const populated = <T extends { _id: string }>(ref: T | string | undefined | null): T | undefined =>
  ref && typeof ref === 'object' ? ref : undefined;

/** Id of a populated reference or a bare id. */
export const refId = (ref: { _id: string } | string | undefined | null): string | undefined =>
  typeof ref === 'string' ? ref : ref?._id;

export const fullName = (user?: { firstName?: string; lastName?: string } | null) =>
  user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || 'User' : 'User';

/** "₹5,000 – ₹10,000" for fixed budgets, "₹1,500 – ₹2,800/hr" for hourly. */
export const formatBudget = (gig: { budgetMin: number; budgetMax: number; budgetType: 'fixed' | 'hourly' }) => {
  const range =
    gig.budgetMin === gig.budgetMax
      ? formatCurrency(gig.budgetMax)
      : `${formatCurrency(gig.budgetMin)} – ${formatCurrency(gig.budgetMax)}`;
  return gig.budgetType === 'hourly' ? `${range}/hr` : range;
};

export const LOCATION_TYPE_LABELS: Record<'remote' | 'onsite' | 'hybrid', string> = {
  remote: 'Remote',
  onsite: 'On-site',
  hybrid: 'Hybrid',
};

export const EXPERIENCE_LABELS: Record<'entry' | 'intermediate' | 'expert', string> = {
  entry: 'Entry level',
  intermediate: 'Intermediate',
  expert: 'Expert',
};

export const PROPOSAL_STATUS_VARIANT: Record<
  'pending' | 'negotiating' | 'accepted' | 'rejected' | 'withdrawn',
  'primary' | 'success' | 'warning' | 'error' | 'secondary'
> = {
  pending: 'primary',
  negotiating: 'warning',
  accepted: 'success',
  rejected: 'error',
  withdrawn: 'secondary',
};

export const GIG_STATUS_META: Record<
  'draft' | 'pending_approval' | 'rejected' | 'open' | 'in_progress' | 'completed' | 'cancelled',
  { label: string; variant: 'primary' | 'success' | 'warning' | 'error' | 'secondary' }
> = {
  draft: { label: 'Draft', variant: 'secondary' },
  pending_approval: { label: 'Awaiting approval', variant: 'warning' },
  rejected: { label: 'Not approved', variant: 'error' },
  open: { label: 'Open', variant: 'primary' },
  in_progress: { label: 'In progress', variant: 'primary' },
  completed: { label: 'Completed', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'secondary' },
};

export const PAYMENT_STATUS_META: Record<
  PaymentStatus,
  { label: string; variant: 'primary' | 'success' | 'warning' | 'error' | 'secondary' }
> = {
  pending: { label: 'Awaiting payment', variant: 'secondary' },
  escrow: { label: 'In escrow', variant: 'primary' },
  released: { label: 'Released', variant: 'success' },
  refunded: { label: 'Refunded', variant: 'warning' },
  disputed: { label: 'Disputed', variant: 'error' },
  failed: { label: 'Failed', variant: 'error' },
  cancelled: { label: 'Cancelled', variant: 'secondary' },
};

/** Dispute status flow: open → under_review → resolved | closed. */
export const DISPUTE_STATUS_META: Record<'open' | 'under_review' | 'resolved' | 'closed', { label: string; variant: 'primary' | 'success' | 'warning' | 'secondary' }> = {
  open: { label: 'Open', variant: 'warning' },
  under_review: { label: 'Under review', variant: 'primary' },
  resolved: { label: 'Resolved', variant: 'success' },
  closed: { label: 'Closed', variant: 'secondary' },
};
