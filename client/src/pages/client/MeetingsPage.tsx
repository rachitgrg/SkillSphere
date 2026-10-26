import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { CalendarDays } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { QueryState } from '../../components/common/QueryState';
import { BookingRow, WeekCalendar } from '../../components/schedule/ScheduleViews';
import { startOfWeek } from '../../utils/schedule';
import { useBookings } from '../../hooks/queries/useSchedule';

/** /client/meetings — meetings the client booked with freelancers. */
export function MeetingsPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const range = useMemo(() => ({ from: new Date(weekStart.getTime() - 30 * 86_400_000).toISOString(), to: new Date(weekStart.getTime() + 60 * 86_400_000).toISOString() }), [weekStart]);
  const bookings = useBookings(range);
  const upcoming = (bookings.data ?? []).filter((b) => new Date(b.end).getTime() > Date.now() && b.status !== 'cancelled');

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader title="Meetings" description="Calls you booked with freelancers. Book from a freelancer's profile." />
      <QueryState
        isLoading={bookings.isLoading}
        isError={bookings.isError}
        error={bookings.error}
        onRetry={() => bookings.refetch()}
        isEmpty={!upcoming.length}
        empty={{ icon: <CalendarDays className="w-8 h-8" />, title: 'No upcoming meetings', description: 'Open a freelancer profile and pick a time.' }}
      >
        <ul className="glass-card rounded-2xl border border-slate-800 divide-y divide-slate-800">
          {upcoming.map((b) => <BookingRow key={b._id} booking={b} viewer="client" />)}
        </ul>
      </QueryState>
      <WeekCalendar bookings={bookings.data ?? []} weekStart={weekStart} onWeekChange={setWeekStart} />
      <p className="text-xs text-slate-500"><Link to="/search?tab=freelancers" className="text-indigo-400 hover:underline">Find a freelancer</Link> to book a new call.</p>
    </div>
  );
}
