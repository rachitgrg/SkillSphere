import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router';
import { Clock, IndianRupee, Star } from 'lucide-react';
import { Badge } from '../common/Badge';
import { Avatar } from '../common/Avatar';

interface GigCardProps {
  gig: {
    id: string | number;
    title: string;
    description: string;
    category?: string;
    skills: string[];
    budget: number;
    budgetType?: 'fixed' | 'hourly';
    duration?: string;
    experienceLevel?: string;
    client?: {
      name: string;
      avatar?: string;
      rating?: number;
      totalReviews?: number;
      location?: string;
    };
  };
}

export const GigCard: React.FC<GigCardProps> = ({ gig }) => {
  const [isSaved, setIsSaved] = useState(false);

  const formattedBudget = typeof gig.budget === 'number' 
    ? gig.budget.toLocaleString('en-IN') 
    : gig.budget;

  const isHourly = gig.budgetType === 'hourly';

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="glass-card rounded-2xl p-5 border border-slate-800 flex flex-col h-full hover:border-slate-700 transition-all duration-300"
    >
      <div className="flex justify-between items-start mb-2 gap-2">
        <Link 
          to={`/gigs/${gig.id}`} 
          className="text-lg font-bold text-white hover:text-indigo-400 transition-colors line-clamp-2"
        >
          {gig.title}
        </Link>
        <button 
          onClick={() => setIsSaved(!isSaved)}
          className={`p-1.5 rounded-lg transition-colors ${
            isSaved ? 'text-amber-400 bg-amber-400/10' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
          }`}
          title={isSaved ? "Saved to favorites" : "Save project"}
        >
          <Star className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`} />
        </button>
      </div>

      {gig.category && (
        <span className="text-[11px] font-medium text-indigo-400 mb-3 block">
          {gig.category}
        </span>
      )}

      <p className="text-sm text-slate-300 line-clamp-3 mb-4 flex-grow leading-relaxed">
        {gig.description}
      </p>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {gig.skills?.map((skill: string) => (
          <Badge key={skill} variant="secondary" className="bg-slate-900/80 text-slate-300 border border-slate-800 text-xs px-2.5 py-1">
            {skill}
          </Badge>
        ))}
      </div>

      <div className="flex flex-col gap-3 mt-auto pt-4 border-t border-slate-800/60">
        <div className="flex justify-between items-center text-sm">
          <div className="flex items-center text-slate-300">
            <IndianRupee className="w-4 h-4 mr-0.5 text-emerald-400" />
            <span className="font-bold text-white text-base">₹{formattedBudget}</span>
            <span className="text-xs text-slate-400 ml-1">
              {isHourly ? '/hr' : 'Fixed'}
            </span>
          </div>
          <div className="flex items-center text-xs text-slate-400">
            <Clock className="w-3.5 h-3.5 mr-1 text-slate-500" />
            <span>{gig.duration || 'Flexible'}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center min-w-0 pr-2">
            <Avatar 
              src={gig.client?.avatar} 
              firstName={gig.client?.name?.split(' ')[0] || 'C'} 
              lastName={gig.client?.name?.split(' ')[1] || 'L'} 
              size="sm" 
            />
            <div className="ml-2 min-w-0">
              <p className="text-xs font-medium text-white truncate">{gig.client?.name || 'Client'}</p>
              <div className="flex items-center text-[10px] text-slate-400">
                <Star className="w-3 h-3 text-amber-400 mr-0.5 fill-amber-400" />
                <span>{gig.client?.rating || 4.9} ({gig.client?.totalReviews || 12})</span>
              </div>
            </div>
          </div>
          <Link to={`/gigs/${gig.id}`} className="btn-primary text-xs px-3.5 py-1.5 rounded-lg flex-shrink-0">
            <span>View Details</span>
          </Link>
        </div>
      </div>
    </motion.div>
  );
};
