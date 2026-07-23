import React from 'react';

export const AvailabilityCalendar: React.FC = () => {
  return (
    <div className="glass-card p-6 rounded-2xl border border-slate-800 text-center">
      <div className="text-slate-400 mb-4">Availability Calendar</div>
      <div className="grid grid-cols-7 gap-2">
        {/* Placeholder for actual calendar UI */}
        {Array.from({ length: 14 }).map((_, i) => (
          <div key={i} className="h-10 rounded-md bg-slate-800/50 border border-slate-700 flex items-center justify-center text-sm text-slate-300">
            {i + 1}
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500 mt-4">Integrates with date-fns/react-day-picker</p>
    </div>
  );
};
