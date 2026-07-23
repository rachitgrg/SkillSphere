import React from 'react';
import { Avatar } from '../common/Avatar';
import { Clock, DollarSign } from 'lucide-react';

export const ProposalCard: React.FC<{ proposal: any }> = ({ proposal }) => {
  return (
    <div className="glass-card p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row gap-5">
      <div className="flex flex-col items-center text-center w-full md:w-48 shrink-0">
        <Avatar src={proposal.freelancer?.avatar} size="lg" className="mb-3" />
        <h4 className="font-medium text-white">{proposal.freelancer?.name || 'Jane Doe'}</h4>
        <p className="text-xs text-slate-400 mb-2">{proposal.freelancer?.title || 'Full Stack Developer'}</p>
        <div className="flex gap-1 text-yellow-500 mb-3">
          {'★'.repeat(5)}
        </div>
        <div className="w-full grid grid-cols-2 gap-2 text-sm border-t border-slate-800 pt-3">
          <div>
            <div className="text-slate-500 text-xs">Bid</div>
            <div className="text-emerald-400 font-semibold">${proposal.bidAmount || 4500}</div>
          </div>
          <div>
            <div className="text-slate-500 text-xs">Time</div>
            <div className="text-white font-semibold">{proposal.estimatedTime || '4 wks'}</div>
          </div>
        </div>
      </div>
      
      <div className="flex-1 border-t md:border-t-0 md:border-l border-slate-800 pt-4 md:pt-0 md:pl-5">
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-semibold text-lg text-white">Cover Letter</h3>
          <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded-md">
            Submitted 2h ago
          </span>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed mb-4 line-clamp-4">
          {proposal.coverLetter || 'Hi there! I am very interested in this project. I have over 5 years of experience building scalable SaaS applications using React and Node.js. I have reviewed your requirements and I am confident I can deliver high-quality code within your specified timeline.'}
        </p>
        
        <div className="flex justify-end gap-3 mt-auto">
          <button className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
            Message
          </button>
          <button className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors">
            Accept Proposal
          </button>
        </div>
      </div>
    </div>
  );
};
