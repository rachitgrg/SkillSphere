import React from 'react';
import { m } from 'framer-motion';
import { Link } from 'react-router';
import { Clock, IndianRupee, MapPin, Users } from 'lucide-react';
import { Badge } from '../common/Badge';
import { Avatar } from '../common/Avatar';
import type { Gig, UserSummary } from '../../types';
import { formatBudget, formatTimeAgo, fullName, LOCATION_TYPE_LABELS, populated } from '../../utils/helpers';

interface GigCardProps {
  gig: Gig;
  /** Extra controls rendered in the footer (e.g. status badge on "My gigs"). */
  footer?: React.ReactNode;
}

export const GigCard: React.FC<GigCardProps> = ({ gig, footer }) => {
  const client = populated<UserSummary>(gig.client);
  const city = client?.address?.city;

  return (
    <m.div
      whileHover={{ y: -4 }}
      className="glass-card rounded-2xl p-5 border border-slate-800 flex flex-col h-full hover:border-slate-700 transition-all duration-300"
    >
      <div className="flex justify-between items-start mb-1 gap-2">
        <Link
          to={`/gigs/${gig._id}`}
          className="text-lg font-bold text-white hover:text-indigo-400 transition-colors line-clamp-2 focus-ring rounded"
        >
          {gig.title}
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] mb-3">
        <span className="font-medium text-indigo-400">{gig.category}</span>
        <span className="text-slate-500">{formatTimeAgo(gig.createdAt)}</span>
      </div>

      <p className="text-sm text-slate-300 line-clamp-3 mb-4 flex-grow leading-relaxed">{gig.description}</p>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {gig.skills.slice(0, 6).map((skill) => (
          <Badge key={skill} variant="secondary" className="bg-slate-900/80 text-slate-300 border border-slate-800 text-xs px-2.5 py-1">
            {skill}
          </Badge>
        ))}
        {gig.skills.length > 6 && <span className="text-xs text-slate-500 self-center">+{gig.skills.length - 6}</span>}
      </div>

      <div className="flex flex-col gap-3 mt-auto pt-4 border-t border-slate-800/60">
        <div className="flex justify-between items-center text-sm gap-2">
          <div className="flex items-center text-slate-300 min-w-0">
            <IndianRupee className="w-4 h-4 mr-1 text-emerald-400 shrink-0" />
            <span className="font-bold text-white truncate">{formatBudget(gig)}</span>
            <span className="text-xs text-slate-400 ml-1.5 shrink-0">{gig.budgetType === 'hourly' ? 'Hourly' : 'Fixed'}</span>
          </div>
          <div className="flex items-center text-xs text-slate-400 shrink-0">
            <Clock className="w-3.5 h-3.5 mr-1 text-slate-500" />
            <span>{gig.duration}</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-cyan-400" />
            {LOCATION_TYPE_LABELS[gig.locationType]}
            {gig.locationType !== 'remote' && city ? ` · ${city}` : ''}
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {gig.totalProposals} {gig.totalProposals === 1 ? 'proposal' : 'proposals'}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          {client ? (
            <div className="flex items-center min-w-0">
              <Avatar src={client.avatar} firstName={client.firstName} lastName={client.lastName} size="sm" />
              <p className="ml-2 text-xs font-medium text-white truncate">{fullName(client)}</p>
            </div>
          ) : (
            <span />
          )}
          {footer ?? (
            <Link to={`/gigs/${gig._id}`} className="btn-primary text-xs px-3.5 py-1.5 rounded-lg flex-shrink-0">
              <span>View Details</span>
            </Link>
          )}
        </div>
      </div>
    </m.div>
  );
};
