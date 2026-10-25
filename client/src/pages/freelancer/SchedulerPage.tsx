import { Link } from 'react-router';
import { PageHeader } from '../../components/common/PageHeader';
import { QueryState } from '../../components/common/QueryState';
import { AvailabilityCalendar } from '../../components/profile/AvailabilityCalendar';
import { useMe } from '../../hooks/queries/useProfiles';
import type { FreelancerProfile } from '../../types';

// Bookings, the calendar grid and auto-scheduling arrive with plan 4.12.
export function SchedulerPage() {
  const me = useMe();
  const profile = me.data?.profile as FreelancerProfile | undefined;
  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Schedule"
        description="Your weekly availability. Clients can book meetings inside these hours."
        actions={<Link to="/freelancer/profile/edit" className="btn-secondary px-4 py-2 text-sm">Edit hours</Link>}
      />
      <QueryState isLoading={me.isLoading} isError={me.isError} error={me.error}>
        <div className="glass-card rounded-2xl border border-slate-800 p-6">
          <AvailabilityCalendar slots={profile?.availabilitySlots ?? []} />
        </div>
      </QueryState>
    </div>
  );
}
