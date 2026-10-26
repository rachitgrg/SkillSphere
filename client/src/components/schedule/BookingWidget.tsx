import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import toast from 'react-hot-toast';
import { Sparkles } from 'lucide-react';
import { Button } from '../common/Button';
import { useAvailability, useScheduleMutation } from '../../hooks/queries/useSchedule';
import { scheduleApi } from '../../api/scheduleApi';
import { useAppSelector } from '../../hooks/useRedux';
import type { TimeSlot } from '../../types';
import { getErrorMessage } from '../../utils/helpers';

const DAY_MS = 86_400_000;
const DURATIONS = [30, 60, 90, 120];
const fieldClass = 'w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white';
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

/** Slots that start a run of free slots long enough for `minutes`. */
const startable = (slots: TimeSlot[], minutes: number) => {
  const needed = minutes / 30;
  return slots.filter((_, i) => {
    const run = slots.slice(i, i + needed);
    return run.length === needed && run.every((s, k) => k === 0 || s.start === run[k - 1].end);
  });
};

/** Public profile: pick a day and time inside the freelancer's free hours, or let the server find the next one. */
export function BookingWidget({ freelancerId, freelancerName }: { freelancerId: string; freelancerName: string }) {
  const user = useAppSelector((s) => s.auth.user);
  const range = useMemo(() => {
    const from = new Date();
    return { from: from.toISOString(), to: new Date(from.getTime() + 14 * DAY_MS).toISOString() };
  }, []);
  const availability = useAvailability(freelancerId, range.from, range.to);
  const [duration, setDuration] = useState(60);
  const [day, setDay] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [title, setTitle] = useState('Intro call');
  const book = useScheduleMutation((start: string) => scheduleApi.book({ freelancerId, start, durationMinutes: duration, title }));
  const auto = useScheduleMutation(() => scheduleApi.autoSchedule({ freelancerId, durationMinutes: duration, book: true, title }));

  const starts = startable(availability.data?.slots ?? [], duration);
  const byDay = new Map<string, TimeSlot[]>();
  for (const s of starts) {
    const key = new Date(s.start).toDateString();
    byDay.set(key, [...(byDay.get(key) ?? []), s]);
  }
  const days = [...byDay.keys()];
  const activeDay = day && byDay.has(day) ? day : days[0];

  if (!user || user.role !== 'client') {
    return (
      <p className="text-sm text-slate-400">
        {user ? 'Clients can book a call here.' : <><Link to="/login" className="text-indigo-400 hover:underline">Log in as a client</Link> to book a call.</>}
      </p>
    );
  }

  const confirm = async (start: string) => {
    if (title.trim().length < 3) return toast.error('Add a short title');
    try {
      const booking = await book.mutateAsync(start);
      toast.success(booking.status === 'confirmed' ? 'Meeting booked' : `Request sent — ${freelancerName} will confirm`);
      setPicked(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const findNext = async () => {
    try {
      const res = await auto.mutateAsync(undefined);
      toast.success(`Booked ${new Date(res.slot.start).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-slate-400">
          Length
          <select value={duration} onChange={(e) => { setDuration(Number(e.target.value)); setPicked(null); }} className={`${fieldClass} mt-1`}>
            {DURATIONS.map((d) => <option key={d} value={d}>{d} min</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-400">
          Topic
          <input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} className={`${fieldClass} mt-1`} />
        </label>
      </div>
      {availability.isLoading && <p className="text-sm text-slate-500">Loading free times…</p>}
      {availability.isError && <p className="text-sm text-red-300">{getErrorMessage(availability.error)}</p>}
      {availability.data && !days.length && <p className="text-sm text-slate-500">No free times in the next two weeks.</p>}
      {days.length > 0 && (
        <>
          <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Day">
            {days.map((d) => (
              <button
                key={d}
                type="button"
                role="tab"
                aria-selected={d === activeDay}
                onClick={() => { setDay(d); setPicked(null); }}
                className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-xs ${d === activeDay ? 'border-indigo-400 bg-indigo-500/20 text-white' : 'border-slate-700 text-slate-300 hover:border-slate-500'}`}
              >
                {new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {(byDay.get(activeDay!) ?? []).map((s) => (
              <button
                key={s.start}
                type="button"
                onClick={() => setPicked(s.start)}
                aria-pressed={picked === s.start}
                className={`rounded-lg border px-2 py-1.5 text-xs ${picked === s.start ? 'border-emerald-400 bg-emerald-500/20 text-white' : 'border-slate-700 text-slate-300 hover:border-slate-500'}`}
              >
                {time(s.start)}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="flex flex-wrap gap-2">
        {picked && (
          <Button size="sm" onClick={() => confirm(picked)} isLoading={book.isPending}>
            Book {time(picked)}
          </Button>
        )}
        <Button size="sm" variant="secondary" icon={<Sparkles className="w-4 h-4" />} onClick={findNext} isLoading={auto.isPending}>
          Find next available
        </Button>
      </div>
      <p className="text-[11px] text-slate-500">Times shown in your time zone. Their hours: {availability.data?.timezone ?? '—'}.</p>
    </div>
  );
}
