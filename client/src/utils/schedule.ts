import type { Booking, BookingStatus } from '../types';

export const STATUS_VARIANT: Record<BookingStatus, 'primary' | 'success' | 'warning' | 'error' | 'secondary'> = {
  pending: 'warning',
  confirmed: 'success',
  cancelled: 'secondary',
  completed: 'primary',
};

/** Monday 00:00 (local time) of the week containing `date`. */
export const startOfWeek = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
};

export const formatRange = (b: Pick<Booking, 'start' | 'end'>) => {
  const start = new Date(b.start);
  const end = new Date(b.end);
  const day = start.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  const time = (d: Date) => d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time(start)}–${time(end)}`;
};
