import React from 'react';
import { ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';

export const TransactionCard: React.FC<{ transaction: any }> = ({ transaction }) => {
  const isCredit = transaction.type === 'credit';
  
  return (
    <div className="flex items-center justify-between p-4 border-b border-slate-800 last:border-0 hover:bg-slate-800/30 transition-colors">
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
          isCredit ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
        }`}>
          {isCredit ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
        </div>
        <div>
          <h4 className="font-medium text-white">{transaction.description || 'Payment for Milestone 1'}</h4>
          <div className="flex items-center text-xs text-slate-500 mt-1">
            <Clock className="w-3 h-3 mr-1" />
            <span>{transaction.date || 'Oct 24, 2023'}</span>
            <span className="mx-2">•</span>
            <span>Ref: {transaction.id || '#TXN-12345'}</span>
          </div>
        </div>
      </div>
      
      <div className="text-right">
        <div className={`font-semibold ${isCredit ? 'text-emerald-400' : 'text-white'}`}>
          {isCredit ? '+' : '-'}${transaction.amount || '1,500.00'}
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full mt-1 inline-block ${
          transaction.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
          transaction.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400' :
          'bg-slate-800 text-slate-400'
        }`}>
          {transaction.status || 'completed'}
        </span>
      </div>
    </div>
  );
};
