import React from 'react';
import { motion } from 'framer-motion';

export const TypingIndicator: React.FC = () => {
  return (
    <div className="flex items-center gap-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-sm w-fit mb-4">
      <motion.div 
        animate={{ y: [0, -5, 0] }} 
        transition={{ repeat: Infinity, duration: 0.6, delay: 0 }}
        className="w-1.5 h-1.5 bg-slate-400 rounded-full"
      />
      <motion.div 
        animate={{ y: [0, -5, 0] }} 
        transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }}
        className="w-1.5 h-1.5 bg-slate-400 rounded-full"
      />
      <motion.div 
        animate={{ y: [0, -5, 0] }} 
        transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }}
        className="w-1.5 h-1.5 bg-slate-400 rounded-full"
      />
    </div>
  );
};
