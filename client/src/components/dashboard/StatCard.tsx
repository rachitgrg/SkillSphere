import React from 'react';
import { motion } from 'framer-motion';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
  color?: 'indigo' | 'emerald' | 'cyan' | 'violet' | 'amber';
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon, trend, color = 'indigo' }) => {
  const colorMap = {
    indigo: 'from-indigo-500/20 to-indigo-500/5 text-indigo-400 border-indigo-500/20',
    emerald: 'from-emerald-500/20 to-emerald-500/5 text-emerald-400 border-emerald-500/20',
    cyan: 'from-cyan-500/20 to-cyan-500/5 text-cyan-400 border-cyan-500/20',
    violet: 'from-violet-500/20 to-violet-500/5 text-violet-400 border-violet-500/20',
    amber: 'from-amber-500/20 to-amber-500/5 text-amber-400 border-amber-500/20',
  };

  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className={`glass-card p-6 rounded-2xl border ${colorMap[color].split(' ')[2]} relative overflow-hidden`}
    >
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${colorMap[color].split(' ')[0]} ${colorMap[color].split(' ')[1]} rounded-bl-full -z-10 blur-xl opacity-50`}></div>
      
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl bg-slate-900 border ${colorMap[color].split(' ')[2]} ${colorMap[color].split(' ')[2].replace('border', 'text')}`}>
          {icon}
        </div>
        {trend && (
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
            trend.isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
          }`}>
            {trend.isPositive ? '+' : '-'}{Math.abs(trend.value)}%
          </span>
        )}
      </div>
      
      <div>
        <h4 className="text-sm font-medium text-slate-400 mb-1">{title}</h4>
        <div className="text-3xl font-bold text-white">{value}</div>
      </div>
    </motion.div>
  );
};
