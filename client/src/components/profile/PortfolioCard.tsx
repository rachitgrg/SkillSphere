import React from 'react';
import { motion } from 'framer-motion';

interface PortfolioCardProps {
  title: string;
  description: string;
  imageUrl: string;
  link?: string;
}

export const PortfolioCard: React.FC<PortfolioCardProps> = ({ title, description, imageUrl, link }) => {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="group relative rounded-xl overflow-hidden glass-card border border-slate-800"
    >
      <div className="aspect-w-16 aspect-h-9 w-full bg-slate-800 relative">
        <img src={imageUrl} alt={title} className="object-cover w-full h-full opacity-80 group-hover:opacity-100 transition-opacity" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 to-transparent"></div>
      </div>
      <div className="absolute bottom-0 left-0 p-4 w-full">
        <h4 className="text-lg font-semibold text-white">{title}</h4>
        <p className="text-sm text-slate-300 mt-1 line-clamp-2">{description}</p>
        {link && (
          <a href={link} target="_blank" rel="noopener noreferrer" className="inline-block mt-3 text-xs font-medium text-indigo-400 hover:text-indigo-300">
            View Project &rarr;
          </a>
        )}
      </div>
    </motion.div>
  );
};
