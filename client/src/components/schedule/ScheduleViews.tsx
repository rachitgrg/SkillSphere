import { useState } from 'react';
import toast from 'react-hot-toast';
import { CalendarCheck, ChevronLeft, ChevronRight, Link2, Video } from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { scheduleApi } from '../../api/scheduleApi';
import { useScheduleMutation } from '../../hooks/queries/useSchedule';
import type { Booking } from '../../types';
import { STATUS_VARIANT, formatRange } from '../../utils/schedule';
import { fullName, getErrorMessage } from '../../utils/helpers';

const DAY_MS = 86_400_000;
const FIRST_HOUR = 7;
const LAST_HOUR = 22;
const HOUR_PX = 40;

/** Week grid (viewer's local time) with bookings positioned by start/end. */
export function WeekCalendar({ bookings, weekStart, onWeekChange }: { bookings: Booking[]; weekStart: Date; onWeekChange: (d: Date) => void }) {
  const days = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * DAY_MS));
  const hours = Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, i) => FIRST_HOUR + i);
  const visible = bookings.filter((b) => b.status !== 'cancelled');
  const today = new Date().toDateString();

  return (
    <div className="glass-card rounded-2xl border border-slate-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <button type="button" aria-label="Previous week" className="btn-ghost p-2" onClick={() => onWeekChange(new Date(weekStart.getTime() - 7 * DAY_MS))}>
          <ChevronLeft className="w-4 h-4" />
        </button>
        <p className="text-sm text-white font-medium">
          {days[0].toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – {days[6].toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
        <button type="button" aria-label="Next week" className="btn-ghost p-2" onClick={() => onWeekChange(new Date(weekStart.getTime() + 7 * DAY_MS))}>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="overflow-x-auto">
        <div className="grid min-w-[640px]" style={{ gridTemplateColumns: '3rem repeat(7, minmax(0, 1fr))' }}>
          <div />
          {days.map((d) => (
            <div key={d.toISOString()} className={`text-center text-xs pb-2 ${d.toDateString() === today ? 'text-indigo-300 font-semibold' : 'text-slate-400'}`}>
              {d.toLocaleDateString('en-IN', { weekday: 'short' })} {d.getDate()}
            </div>
          ))}
          <div className="relative" style={{ height: hours.length * HOUR_PX }}>
            {hours.map((h, i) => (
              <span key={h} className="absolute right-1 text-[10px] text-slate-500" style={{ top: i * HOUR_PX - 6 }}>
                {h}:00
              </span>
            ))}
          </div>
          {days.map((d) => {
            const dayBookings = visible.filter((b) => new Date(b.start).toDateString() === d.toDateString());
            return (
              <div key={d.toISOString()} className="relative border-l border-slate-800" style={{ height: hours.length * HOUR_PX }}>
                {hours.map((h, i) => (
                  <div key={h} className="absolute inset-x-0 border-t border-slate-800/60" style={{ top: i * HOUR_PX }} />
                ))}
                {dayBookings.map((b) => {
                  const s = new Date(b.start);
                  const e = new Date(b.end);
                  const top = (s.getHours() + s.getMinutes() / 60 - FIRST_HOUR) * HOUR_PX;
                  const height = Math.max(((e.getTime() - s.getTime()) / 3_600_000) * HOUR_PX - 2, 16);
                  return (
                    <div
                      key={b._id}
                      title={`${b.title} · ${formatRange(b)}`}
                      className={`absolute inset-x-1 rounded-md px-1.5 py-0.5 text-[10px] leading-tight overflow-hidden ${
                        b.status === 'confirmed' ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-100' : b.status === 'pending' ? 'bg-amber-500/20 border border-amber-400/40 text-amber-100' : 'bg-indigo-500/20 border border-indigo-400/40 text-indigo-100'
                      }`}
                      style={{ top: Math.max(top, 0), height }}
                    >
                      {b.title}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-[11px] text-slate-500 mt-2">Times in your browser&apos;s time zone ({Intl.DateTimeFormat().resolvedOptions().timeZone}).</p>
    </div>
  );
}

/** Booking row with the actions the viewer may take. */
export function BookingRow({ booking, viewer }: { booking: Booking; viewer: 'freelancer' | 'client' }) {
  const other = viewer === 'freelancer' ? booking.client : booking.freelancer;
  const [link, setLink] = useState(booking.meetingLink ?? '');
  const update = useScheduleMutation((input: Parameters<typeof scheduleApi.update>[1]) => scheduleApi.update(booking._id, input));
  const run = (input: Parameters<typeof scheduleApi.update>[1], ok: string) =>
    update.mutateAsync(input).then(() => toast.success(ok), (e) => toast.error(getErrorMessage(e)));
  const ended = new Date(booking.end).getTime() < Date.now();
  const open = ['pending', 'confirmed'].includes(booking.status);

  return (
    <li className="p-4 flex flex-col gap-3 sm:flex-row sm:items-start">
      <Avatar src={other.avatar} firstName={other.firstName} lastName={other.lastName} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium flex items-center gap-2 flex-wrap">
          {booking.title} <Badge variant={STATUS_VARIANT[booking.status]}>{booking.status}</Badge>
        </p>
        <p className="text-xs text-slate-400">{formatRange(booking)} · with {fullName(other)}{booking.gig && ` · ${booking.gig.title}`}</p>
        {booking.notes && <p className="text-xs text-slate-500 mt-1 whitespace-pre-line">{booking.notes}</p>}
        {booking.meetingLink && booking.status === 'confirmed' && (
          <a href={booking.meetingLink} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-indigo-300 hover:underline">
            <Video className="w-3.5 h-3.5" /> Join meeting
          </a>
        )}
        {viewer === 'freelancer' && booking.status === 'confirmed' && !ended && (
          <div className="mt-2 flex gap-2">
            <label htmlFor={`link-${booking._id}`} className="sr-only">Meeting link</label>
            <input id={`link-${booking._id}`} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.google.com/…" className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white" />
            <Button size="sm" variant="ghost" icon={<Link2 className="w-3.5 h-3.5" />} disabled={link === (booking.meetingLink ?? '')} onClick={() => run({ meetingLink: link }, 'Link saved')}>
              Save
            </Button>
          </div>
        )}
      </div>
      {open && (
        <div className="flex gap-2 shrink-0">
          {viewer === 'freelancer' && booking.status === 'pending' && (
            <Button size="sm" icon={<CalendarCheck className="w-4 h-4" />} isLoading={update.isPending} onClick={() => run({ status: 'confirmed' }, 'Meeting confirmed')}>
              Confirm
            </Button>
          )}
          {viewer === 'freelancer' && booking.status === 'confirmed' && ended && (
            <Button size="sm" variant="secondary" onClick={() => run({ status: 'completed' }, 'Marked as done')}>Done</Button>
          )}
          {!ended && (
            <Button size="sm" variant="ghost" onClick={() => run({ status: 'cancelled' }, viewer === 'freelancer' && booking.status === 'pending' ? 'Declined' : 'Cancelled')}>
              {viewer === 'freelancer' && booking.status === 'pending' ? 'Decline' : 'Cancel'}
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
