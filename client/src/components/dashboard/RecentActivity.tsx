import React from 'react';

export interface ActivityItem {
  content: React.ReactNode;
  time: string;
  icon?: React.ReactNode;
}

export const RecentActivity: React.FC<{ activities: ActivityItem[] }> = ({ activities }) => {
  return (
    <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
      <div className="p-5 border-b border-slate-800 flex justify-between items-center">
        <h3 className="font-semibold text-white">Recent Activity</h3>
        <button className="text-xs text-indigo-400 hover:text-indigo-300">View All</button>
      </div>
      <div className="p-5 space-y-6">
        {activities.map((activity, index) => (
          <div key={index} className="flex gap-4 relative">
            {index < activities.length - 1 && (
              <div className="absolute left-[15px] top-8 w-0.5 h-full -z-10 bg-slate-800"></div>
            )}
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
              {activity.icon || <div className="w-2 h-2 rounded-full bg-indigo-500" />}
            </div>
            <div>
              <p className="text-sm text-slate-200">{activity.content}</p>
              <p className="text-xs text-slate-500 mt-1">{activity.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
