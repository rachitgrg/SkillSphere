import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import toast from 'react-hot-toast';
import { Briefcase, Plus } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { QueryState } from '../../components/common/QueryState';
import { StatusTabs } from '../../components/common/StatusTabs';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Pagination } from '../../components/common/Pagination';
import { useCancelGig, useDeleteGig, useMyGigs } from '../../hooks/queries/useDashboard';
import type { Gig, GigStatus } from '../../types';
import { formatBudget, formatTimeAgo, getErrorMessage, GIG_STATUS_META } from '../../utils/helpers';

type Tab = 'active' | 'review' | 'completed' | 'closed';

const TAB_STATUSES: Record<Tab, GigStatus[]> = {
  active: ['open', 'in_progress'],
  review: ['pending_approval', 'rejected', 'draft'],
  completed: ['completed'],
  closed: ['cancelled'],
};

export function ClientGigsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('active');
  const [page, setPage] = useState(1);
  const gigs = useMyGigs({ status: TAB_STATUSES[tab], page, limit: 10 });

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="My gigs"
        description="Everything you've posted, from approval to completion."
        actions={
          <Link to="/client/gigs/new" className="btn-primary px-4 py-2 text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" />
            <span>Post a gig</span>
          </Link>
        }
      />
      <StatusTabs
        label="Filter gigs"
        value={tab}
        onChange={(t) => {
          setTab(t);
          setPage(1);
        }}
        tabs={[
          { value: 'active', label: 'Active' },
          { value: 'review', label: 'Awaiting approval' },
          { value: 'completed', label: 'Completed' },
          { value: 'closed', label: 'Cancelled' },
        ]}
      />
      <QueryState
        isLoading={gigs.isLoading}
        isError={gigs.isError}
        error={gigs.error}
        onRetry={() => gigs.refetch()}
        isEmpty={!gigs.data?.items.length}
        empty={{
          icon: <Briefcase className="w-8 h-8" />,
          title: 'No gigs here',
          description: tab === 'active' ? 'Post a gig; it goes live once an admin approves it.' : 'Nothing in this tab yet.',
          action: tab === 'active' ? { label: 'Post a gig', onClick: () => navigate('/client/gigs/new') } : undefined,
        }}
      >
        <div className="space-y-3">
          {gigs.data?.items.map((gig) => <MyGigRow key={gig._id} gig={gig} />)}
        </div>
        {gigs.data && (
          <div className="mt-6">
            <Pagination currentPage={page} totalPages={gigs.data.pagination.pages} onPageChange={setPage} />
          </div>
        )}
      </QueryState>
    </div>
  );
}

function MyGigRow({ gig }: { gig: Gig }) {
  const cancel = useCancelGig();
  const remove = useDeleteGig();
  const [confirm, setConfirm] = useState<'cancel' | 'delete' | null>(null);
  const meta = GIG_STATUS_META[gig.status];
  const canDelete = ['draft', 'pending_approval', 'rejected', 'open'].includes(gig.status);
  const canCancel = !['completed', 'cancelled'].includes(gig.status);

  const run = async () => {
    try {
      if (confirm === 'delete') await remove.mutateAsync(gig._id);
      if (confirm === 'cancel') await cancel.mutateAsync(gig._id);
      toast.success(confirm === 'delete' ? 'Gig deleted' : 'Gig cancelled');
      setConfirm(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <article className="glass-card rounded-2xl border border-slate-800 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Link to={`/gigs/${gig._id}`} className="font-semibold text-white hover:text-indigo-400 truncate">
            {gig.title}
          </Link>
          <Badge variant={meta.variant}>{meta.label}</Badge>
        </div>
        <p className="text-xs text-slate-500">
          {formatBudget(gig)} · posted {formatTimeAgo(gig.createdAt)} · {gig.totalProposals} {gig.totalProposals === 1 ? 'proposal' : 'proposals'} · {gig.views} views
        </p>
        {gig.status === 'rejected' && gig.rejectionReason && (
          <p className="text-xs text-red-300 mt-1">Reason: {gig.rejectionReason}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2 shrink-0">
        {['open', 'in_progress', 'completed'].includes(gig.status) && (
          <Link to={`/client/gigs/${gig._id}/proposals`} className="btn-secondary px-3 py-1.5 text-xs">
            Proposals
          </Link>
        )}
        {['in_progress', 'completed'].includes(gig.status) && (
          <Link to={`/projects/${gig._id}`} className="btn-primary px-3 py-1.5 text-xs">
            <span>Project</span>
          </Link>
        )}
        {canDelete ? (
          <Button size="sm" variant="ghost" onClick={() => setConfirm('delete')}>
            Delete
          </Button>
        ) : (
          canCancel && (
            <Button size="sm" variant="ghost" onClick={() => setConfirm('cancel')}>
              Cancel gig
            </Button>
          )
        )}
      </div>

      <Modal isOpen={confirm !== null} onClose={() => setConfirm(null)} title={confirm === 'delete' ? 'Delete this gig?' : 'Cancel this gig?'} size="sm">
        <p className="text-sm text-slate-300 mb-6">
          {confirm === 'delete'
            ? 'The gig and its proposals are removed permanently.'
            : 'Open proposals are declined. Money held in escrow must be refunded or disputed first.'}
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setConfirm(null)}>
            Keep it
          </Button>
          <Button variant="danger" onClick={run} isLoading={cancel.isPending || remove.isPending}>
            {confirm === 'delete' ? 'Delete' : 'Cancel gig'}
          </Button>
        </div>
      </Modal>
    </article>
  );
}
