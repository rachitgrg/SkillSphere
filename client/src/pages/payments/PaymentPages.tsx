import { useState } from 'react';
import { CreditCard, Download } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { QueryState } from '../../components/common/QueryState';
import { StatusTabs } from '../../components/common/StatusTabs';
import { Pagination } from '../../components/common/Pagination';
import { Button } from '../../components/common/Button';
import { TransactionCard } from '../../components/payments/TransactionCard';
import { usePaymentHistory, usePaymentSummary } from '../../hooks/queries/useDashboard';
import { useAppSelector } from '../../hooks/useRedux';
import { paymentApi } from '../../api/paymentApi';
import type { Payment, PaymentStatus, UserSummary } from '../../types';
import { downloadCsv, formatCurrency, fullName, getErrorMessage, populated } from '../../utils/helpers';
import toast from 'react-hot-toast';

type Filter = 'all' | PaymentStatus;

const csvRow = (p: Payment) => {
  const gig = populated<{ _id: string; title: string }>(p.gig as { _id: string; title: string });
  return [
    new Date(p.createdAt).toISOString().slice(0, 10),
    gig?.title ?? '',
    fullName(populated<UserSummary>(p.client as UserSummary)),
    fullName(populated<UserSummary>(p.freelancer as UserSummary)),
    p.status,
    p.amount,
    p.platformFee,
    p.freelancerAmount,
    p.razorpayPaymentId ?? '',
  ];
};

/** Transaction history for clients (/client/payments) and freelancers (/freelancer/earnings). */
export function TransactionHistoryPage() {
  const role = useAppSelector((s) => s.auth.user?.role) ?? 'client';
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const history = usePaymentHistory({ status: filter === 'all' ? undefined : filter, page, limit: 15 });
  const summary = usePaymentSummary();
  const s = summary.data;
  const isFreelancer = role === 'freelancer';

  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows: (string | number)[][] = [['Date', 'Gig', 'Client', 'Freelancer', 'Status', 'Amount', 'Platform fee', 'Freelancer amount', 'Razorpay payment']];
      for (let p = 1; ; p++) {
        const res = await paymentApi.getHistory({ status: filter === 'all' ? undefined : filter, page: p, limit: 50 });
        rows.push(...res.items.map(csvRow));
        if (p >= res.pagination.pages) break;
      }
      downloadCsv(`skillsphere-transactions-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Export failed'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={isFreelancer ? 'Earnings' : 'Payments'}
        description={isFreelancer ? 'Escrowed and released payments for your work.' : 'Money you have put into escrow and released.'}
        actions={
          <Button variant="secondary" size="sm" icon={<Download className="w-4 h-4" />} onClick={exportCsv} isLoading={exporting}>
            Export CSV
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'In escrow', value: s?.inEscrow },
          { label: isFreelancer ? 'Earned (released)' : 'Released', value: s?.released },
          { label: 'Refunded', value: s?.refunded },
          { label: isFreelancer ? 'Platform fees' : 'Fees on released', value: s?.fees },
        ].map((card) => (
          <div key={card.label} className="glass-card rounded-2xl border border-slate-800 p-4">
            <div className="text-xs text-slate-400">{card.label}</div>
            <div className="text-xl font-bold text-white mt-1">{card.value === undefined ? '—' : formatCurrency(card.value)}</div>
          </div>
        ))}
      </div>

      <StatusTabs
        label="Filter payments"
        value={filter}
        onChange={(f) => {
          setFilter(f);
          setPage(1);
        }}
        tabs={[
          { value: 'all', label: 'All' },
          { value: 'escrow', label: 'In escrow' },
          { value: 'released', label: 'Released' },
          { value: 'refunded', label: 'Refunded' },
          { value: 'disputed', label: 'Disputed' },
          { value: 'pending', label: 'Pending' },
        ]}
      />

      <QueryState
        isLoading={history.isLoading}
        isError={history.isError}
        error={history.error}
        onRetry={() => history.refetch()}
        isEmpty={!history.data?.items.length}
        empty={{ icon: <CreditCard className="w-8 h-8" />, title: 'No transactions', description: 'Milestone payments appear here once they are funded.' }}
      >
        <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
          {history.data?.items.map((p) => <TransactionCard key={p._id} payment={p} viewerRole={role} />)}
        </div>
        {history.data && (
          <div className="mt-6">
            <Pagination currentPage={page} totalPages={history.data.pagination.pages} onPageChange={setPage} />
          </div>
        )}
      </QueryState>
    </div>
  );
}
