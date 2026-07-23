import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns';

export const formatDate = (date: string) => {
  const parsed = parseISO(date);
  if (isToday(parsed)) return `Today at ${format(parsed, 'h:mm a')}`;
  if (isYesterday(parsed)) return `Yesterday at ${format(parsed, 'h:mm a')}`;
  return format(parsed, 'MMM d, yyyy');
};

export const formatTimeAgo = (date: string) => {
  return formatDistanceToNow(parseISO(date), { addSuffix: true });
};

export const formatCurrency = (amount: number, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const formatNumber = (num: number) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

export const truncateText = (text: string, maxLength: number) => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};

export const getInitials = (firstName: string, lastName: string) => {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
};

export const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    open: 'badge-success',
    pending: 'badge-warning',
    in_progress: 'badge-primary',
    completed: 'badge-success',
    cancelled: 'badge-error',
    disputed: 'badge-error',
    draft: 'badge-secondary',
    accepted: 'badge-success',
    rejected: 'badge-error',
    shortlisted: 'badge-primary',
    withdrawn: 'badge-secondary',
    available: 'dot-online',
    busy: 'dot-busy',
    unavailable: 'dot-offline',
  };
  return colors[status] || 'badge-secondary';
};

export const getProficiencyWidth = (proficiency: string) => {
  const widths: Record<string, string> = {
    beginner: '25%',
    intermediate: '50%',
    advanced: '75%',
    expert: '100%',
    basic: '25%',
    conversational: '50%',
    fluent: '75%',
    native: '100%',
  };
  return widths[proficiency] || '50%';
};

export const classNames = (...classes: (string | boolean | undefined | null)[]) => {
  return classes.filter(Boolean).join(' ');
};

export const generateId = () => Math.random().toString(36).substring(2, 9);

export const debounce = <T extends (...args: unknown[]) => void>(fn: T, delay: number) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};
