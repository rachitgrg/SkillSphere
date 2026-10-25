import React from 'react';
import { Link } from 'react-router';
import { ArrowDownRight, ArrowUpRight, Clock } from 'lucide-react';
import { Badge } from '../common/Badge';
import type { Payment, UserRole, UserSummary } from '../../types';
import { formatCurrency, formatDate, fullName, PAYMENT_STATUS_META, populated } from '../../utils/helpers';

/** One payment, shown from the viewer's side: freelancers see their net amount, clients the amount paid. */
export const TransactionCard: React.FC<{ payment: Payment; viewerRole: UserRole }> = ({ payment, viewerRole }) => {
  const incoming = viewerRole === 'freelancer';
  const gig = populated<{ _id: string; title: string }>(payment.gig as { _id: string; title: string });
  const counterparty = populated<UserSummary>((incoming ? payment.client : payment.freelancer) as UserSummary);
  const amount = incoming ? payment.freelancerAmount : payment.amount;
  const meta = PAYMENT_STATUS_META[payment.status];

  return (
    <div className="flex items-center justify-between gap-4 p-4 border-b border-slate-800 last:border-0 hover:bg-slate-800/30 transition-colors">
      <div className="flex items-center gap-4 min-w-0">
        <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${incoming ? 'bg-emerald-500/10 text-emerald-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
          {incoming ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
        </div>
        <div className="min-w-0">
          {gig ? (
            <Link to={`/projects/${gig._id}`} className="font-medium text-white hover:text-indigo-400 truncate block">
              {payment.description || gig.title}
            </Link>
          ) : (
            <span className="font-medium text-white">{payment.description || 'Payment'}</span>
          )}
          <div className="flex flex-wrap items-center text-xs text-slate-500 mt-1 gap-x-2">
            <span className="flex items-center"><Clock className="w-3 h-3 mr-1" />{formatDate(payment.createdAt)}</span>
            {counterparty && <span>· {incoming ? 'from' : 'to'} {fullName(counterparty)}</span>}
            {payment.razorpayPaymentId && <span>· {payment.razorpayPaymentId}</span>}
          </div>
        </div>
      </div>

      <div className="text-right shrink-0">
        <div className={`font-semibold ${incoming ? 'text-emerald-400' : 'text-white'}`}>
          {incoming ? '+' : '−'}
          {formatCurrency(amount)}
        </div>
        {incoming && <div className="text-[10px] text-slate-500">after {formatCurrency(payment.platformFee)} fee</div>}
        <Badge variant={meta.variant} className="mt-1">{meta.label}</Badge>
      </div>
    </div>
  );
};
