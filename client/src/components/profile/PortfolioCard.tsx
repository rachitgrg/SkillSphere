import React from 'react';
import { m } from 'framer-motion';
import { ExternalLink, Images } from 'lucide-react';
import type { PortfolioItem } from '../../types';

/** One portfolio item; `onOpen` shows its image gallery. */
export const PortfolioCard: React.FC<{ item: PortfolioItem; onOpen?: () => void }> = ({ item, onOpen }) => {
  const cover = item.images[0];
  return (
    <m.article whileHover={{ y: -4 }} className="group rounded-xl overflow-hidden glass-card border border-slate-800 flex flex-col">
      <button
        type="button"
        onClick={onOpen}
        disabled={!cover}
        className="relative aspect-video w-full bg-gradient-to-br from-indigo-600/30 to-cyan-600/20 focus-ring"
        aria-label={cover ? `Open ${item.title} gallery` : undefined}
      >
        {cover && <img src={cover} alt="" className="object-cover w-full h-full opacity-90 group-hover:opacity-100 transition-opacity" />}
        {item.images.length > 1 && (
          <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white">
            <Images className="w-3 h-3" /> {item.images.length}
          </span>
        )}
      </button>
      <div className="p-4 flex-1 flex flex-col">
        <h4 className="font-semibold text-white">{item.title}</h4>
        <p className="text-sm text-slate-400 mt-1 line-clamp-3 flex-1">{item.description}</p>
        {item.technologies.length > 0 && <p className="text-xs text-slate-500 mt-2">{item.technologies.join(' · ')}</p>}
        {item.url && (
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-3 text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
            View project <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </m.article>
  );
};
