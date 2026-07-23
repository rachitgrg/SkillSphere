import React from 'react';
import { TransactionCard } from '../../components/payments/TransactionCard';

export const PaymentPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white mb-4">Make a Payment</h1>
      <div className="glass-card p-6 rounded-2xl border border-slate-800">
        <p className="text-slate-400">Payment form goes here.</p>
      </div>
    </div>
  );
};

export const TransactionHistoryPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white mb-4">Transaction History</h1>
      <div className="glass-card p-6 rounded-2xl border border-slate-800">
        <TransactionCard transaction={{ type: 'credit', amount: 1500, date: 'Oct 24, 2023', description: 'Payment for Milestone 1', status: 'completed' }} />
        <TransactionCard transaction={{ type: 'debit', amount: 200, date: 'Oct 23, 2023', description: 'Platform Fee', status: 'completed' }} />
      </div>
    </div>
  );
};
