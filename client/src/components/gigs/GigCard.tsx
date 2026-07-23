import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router';
import { Clock, DollarSign, MapPin, Star } from 'lucide-react';
import { Badge } from '../common/Badge';
import { Avatar } from '../common/Avatar';

interface GigCardProps {
  gig: any;
}

export const GigCard: React.FC<GigCardProps> = ({ gig }) => {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="glass-card rounded-2xl p-5 border border-slate-800 flex flex-col h-full"
    >
      <div className="flex justify-between items-start mb-4">
        <Link to={`/gigs/${gig.id || 1}`} className="text-xl font-bold text-white hover:text-indigo-400 transition-colors line-clamp-2">
          {gig.title || 'Senior React Developer Needed'}
        </Link>
        <button className="text-slate-400 hover:text-red-400 transition-colors">
          <Star className="w-5 h-5" />
        </button>
      </div>

      <p className="text-sm text-slate-300 line-clamp-3 mb-4 flex-grow">
        {gig.description || 'We are looking for an experienced React developer to help us build out our new SaaS platform...'}
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        {(gig.skills || ['React', 'TypeScript', 'Node.js']).map((skill: string) => (
          <Badge key={skill} variant="secondary" className="bg-slate-800 text-slate-300">
            {skill}
          </Badge>
        ))}
      </div>

      <div className="flex flex-col gap-3 mt-auto pt-4 border-t border-slate-800/50">
        <div className="flex justify-between text-sm">
          <div className="flex items-center text-slate-300">
            <DollarSign className="w-4 h-4 mr-1 text-emerald-400" />
            <span className="font-semibold text-white">${gig.budget || '5,000'}</span>
            <span className="text-slate-500 ml-1">Fixed</span>
          </div>
          <div className="flex items-center text-slate-400">
            <Clock className="w-4 h-4 mr-1" />
            <span>{gig.duration || '2 months'}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Avatar src={gig.client?.avatar}  size="sm" />
            <div className="ml-2">
              <p className="text-xs font-medium text-white">{gig.client?.name || 'TechCorp Inc.'}</p>
              <div className="flex items-center text-[10px] text-slate-500">
                <Star className="w-3 h-3 text-yellow-500 mr-0.5 fill-current" />
                <span>4.9 (12 reviews)</span>
              </div>
            </div>
          </div>
          <Link to={`/gigs/${gig.id || 1}`} className="btn-primary text-xs px-3 py-1.5 rounded-lg">
            View Details
          </Link>
        </div>
      </div>
    </motion.div>
  );
};
