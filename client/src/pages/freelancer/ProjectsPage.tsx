import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Briefcase } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { QueryState } from '../../components/common/QueryState';
import { StatusTabs } from '../../components/common/StatusTabs';
import { Badge } from '../../components/common/Badge';
import { useMyGigs } from '../../hooks/queries/useDashboard';
import type { GigStatus, UserSummary } from '../../types';
import { formatBudget, formatCurrency, fullName, GIG_STATUS_META, populated } from '../../utils/helpers';

type Tab = 'active' | 'completed' | 'closed';
const STATUSES: Record<Tab, GigStatus[]> = { active: ['in_progress'], completed: ['completed'], closed: ['cancelled'] };

/** Gigs the freelancer was hired on. */
export function ProjectsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('active');
  const projects = useMyGigs({ status: STATUSES[tab], limit: 50 });

  return (
    <div className="max-w-5xl">
      <PageHeader title="My projects" description="Work you've been hired for." />
      <StatusTabs label="Filter projects" value={tab} onChange={setTab} tabs={[
        { value: 'active', label: 'Active' },
        { value: 'completed', label: 'Completed' },
        { value: 'closed', label: 'Cancelled' },
      ]} />
      <QueryState
        isLoading={projects.isLoading}
        isError={projects.isError}
        error={projects.error}
        onRetry={() => projects.refetch()}
        isEmpty={!projects.data?.items.length}
        empty={{ icon: <Briefcase className="w-8 h-8" />, title: 'No projects here', description: 'Send proposals to get hired.', action: { label: 'Find work', onClick: () => navigate('/gigs') } }}
      >
        <div className="space-y-3">
          {projects.data?.items.map((gig) => {
            const approved = gig.milestones.filter((m) => m.status === 'approved').reduce((s, m) => s + m.amount, 0);
            const total = gig.milestones.reduce((s, m) => s + m.amount, 0);
            const percent = total ? Math.round((approved / total) * 100) : 0;
            return (
              <Link key={gig._id} to={`/projects/${gig._id}`} className="block glass-card rounded-2xl border border-slate-800 p-5 hover:border-slate-700">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-white truncate">{gig.title}</h3>
                    <p className="text-xs text-slate-500 mt-1">for {fullName(populated<UserSummary>(gig.client as UserSummary))} · {formatBudget(gig)}</p>
                  </div>
                  <Badge variant={GIG_STATUS_META[gig.status].variant}>{GIG_STATUS_META[gig.status].label}</Badge>
                </div>
                {total > 0 && (
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>{gig.milestones.filter((m) => m.status === 'approved').length}/{gig.milestones.length} milestones approved</span>
                      <span>{formatCurrency(approved)} of {formatCurrency(total)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
                      <div className="h-full bg-indigo-500" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </QueryState>
    </div>
  );
}
