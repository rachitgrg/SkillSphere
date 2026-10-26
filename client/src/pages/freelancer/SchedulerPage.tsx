import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { CalendarDays, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { QueryState } from '../../components/common/QueryState';
import { Button } from '../../components/common/Button';
import { BookingRow, WeekCalendar } from '../../components/schedule/ScheduleViews';
import { startOfWeek } from '../../utils/schedule';
import { useMe } from '../../hooks/queries/useProfiles';
import { useBookings, useScheduleMutation } from '../../hooks/queries/useSchedule';
import { scheduleApi } from '../../api/scheduleApi';
import type { AvailabilitySlot, FreelancerProfile } from '../../types';
import { getErrorMessage } from '../../utils/helpers';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ZONES = ['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles', 'Australia/Sydney', 'UTC'];
const fieldClass = 'bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white';

/** /freelancer/schedule — weekly hours, booking requests and a week calendar. */
export function SchedulerPage() {
  const me = useMe();
  const profile = me.data?.profile as FreelancerProfile | undefined;
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const range = useMemo(() => ({ from: new Date(weekStart.getTime() - 30 * 86_400_000).toISOString(), to: new Date(weekStart.getTime() + 60 * 86_400_000).toISOString() }), [weekStart]);
  const bookings = useBookings(range);
  const upcoming = (bookings.data ?? []).filter((b) => new Date(b.end).getTime() > Date.now() - 86_400_000 && b.status !== 'cancelled');
  const pending = upcoming.filter((b) => b.status === 'pending');

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader title="Schedule" description="Set the hours clients can book, answer meeting requests and see your week." />
      <QueryState isLoading={me.isLoading} isError={me.isError} error={me.error}>
        {profile && <HoursEditor profile={profile} />}
      </QueryState>

      <section>
        <h2 className="text-lg font-semibold text-white mb-3">Requests {pending.length > 0 && <span className="text-amber-300">({pending.length})</span>}</h2>
        <QueryState isLoading={bookings.isLoading} isError={bookings.isError} error={bookings.error} isEmpty={!upcoming.length} empty={{ icon: <CalendarDays className="w-8 h-8" />, title: 'No upcoming meetings', description: 'Clients book from your public profile.' }}>
          <ul className="glass-card rounded-2xl border border-slate-800 divide-y divide-slate-800">
            {upcoming.map((b) => <BookingRow key={b._id} booking={b} viewer="freelancer" />)}
          </ul>
        </QueryState>
      </section>

      <WeekCalendar bookings={bookings.data ?? []} weekStart={weekStart} onWeekChange={setWeekStart} />
    </div>
  );
}

function HoursEditor({ profile }: { profile: FreelancerProfile }) {
  const [slots, setSlots] = useState<AvailabilitySlot[]>(profile.availabilitySlots);
  const [timezone, setTimezone] = useState(profile.timezone ?? 'Asia/Kolkata');
  const [autoConfirm, setAutoConfirm] = useState(profile.autoConfirmBookings ?? false);
  useEffect(() => {
    setSlots(profile.availabilitySlots);
    setTimezone(profile.timezone ?? 'Asia/Kolkata');
    setAutoConfirm(profile.autoConfirmBookings ?? false);
  }, [profile]);
  const save = useScheduleMutation(() => scheduleApi.updateSlots({ availabilitySlots: slots, timezone, autoConfirmBookings: autoConfirm }));
  const zones = ZONES.includes(timezone) ? ZONES : [timezone, ...ZONES];

  const set = (i: number, patch: Partial<AvailabilitySlot>) => setSlots(slots.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const submit = async () => {
    if (slots.some((s) => s.startTime >= s.endTime)) return toast.error('Each slot must end after it starts');
    try {
      await save.mutateAsync(undefined);
      toast.success('Availability saved');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <section className="glass-card rounded-2xl border border-slate-800 p-5 space-y-4">
      <div className="flex flex-wrap items-end gap-4 justify-between">
        <h2 className="text-lg font-semibold text-white">Weekly hours</h2>
        <div className="flex flex-wrap gap-4 items-center">
          <label className="text-xs text-slate-400 flex items-center gap-2">
            Time zone
            <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={fieldClass}>
              {zones.map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-300 flex items-center gap-2">
            <input type="checkbox" checked={autoConfirm} onChange={(e) => setAutoConfirm(e.target.checked)} className="accent-indigo-500" />
            Auto-confirm bookings
          </label>
        </div>
      </div>
      <ul className="space-y-2">
        {slots.map((slot, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor={`day-${i}`}>Day</label>
            <select id={`day-${i}`} value={slot.dayOfWeek} onChange={(e) => set(i, { dayOfWeek: Number(e.target.value) })} className={fieldClass}>
              {DAYS.map((d, n) => <option key={d} value={n}>{d}</option>)}
            </select>
            <input aria-label="From" type="time" step={1800} value={slot.startTime} onChange={(e) => set(i, { startTime: e.target.value })} className={fieldClass} />
            <span className="text-slate-500">–</span>
            <input aria-label="To" type="time" step={1800} value={slot.endTime} onChange={(e) => set(i, { endTime: e.target.value })} className={fieldClass} />
            <button type="button" aria-label="Remove slot" onClick={() => setSlots(slots.filter((_, k) => k !== i))} className="p-1.5 text-slate-500 hover:text-red-400">
              <Trash2 className="w-4 h-4" />
            </button>
          </li>
        ))}
      </ul>
      {slots.length === 0 && <p className="text-sm text-slate-500">No hours set — clients can&apos;t book you yet.</p>}
      <div className="flex justify-between">
        <button type="button" onClick={() => setSlots([...slots, { dayOfWeek: 1, startTime: '10:00', endTime: '18:00' }])} className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
          <Plus className="w-4 h-4" /> Add hours
        </button>
        <Button size="sm" onClick={submit} isLoading={save.isPending}>Save hours</Button>
      </div>
    </section>
  );
}
