import React from 'react';
import { Bell } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router';

export const NotificationDropdown: React.FC<{ isOpen: boolean; onClose: () => void; notifications: any[] }> = ({ isOpen, onClose, notifications }) => {
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose}></div>
      <motion.div 
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.95 }}
        className="absolute right-0 mt-2 w-80 sm:w-96 glass-card border border-slate-700 shadow-2xl shadow-indigo-500/10 rounded-2xl z-50 overflow-hidden"
      >
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
          <h3 className="font-semibold text-white">Notifications</h3>
          <button className="text-xs text-indigo-400 hover:text-indigo-300">Mark all as read</button>
        </div>
        
        <div className="max-h-[400px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <Bell className="w-8 h-8 mx-auto mb-3 opacity-20" />
              <p>No new notifications</p>
            </div>
          ) : (
            notifications.map(notif => (
              <Link 
                key={notif.id}
                to={notif.link || '#'}
                className={`flex gap-3 p-4 hover:bg-slate-800/50 transition-colors border-b border-slate-800/50 last:border-0 ${notif.isRead ? 'opacity-70' : 'bg-indigo-500/5'}`}
                onClick={onClose}
              >
                <div className={`mt-1 flex-shrink-0 w-2 h-2 rounded-full ${notif.isRead ? 'bg-transparent' : 'bg-indigo-500'}`}></div>
                <div>
                  <p className="text-sm text-slate-200">{notif.message}</p>
                  <span className="text-xs text-slate-500 mt-1">{notif.time || '1h ago'}</span>
                </div>
              </Link>
            ))
          )}
        </div>
        
        <div className="p-3 border-t border-slate-800 text-center bg-slate-900/80">
          <Link to="/notifications" className="text-sm text-indigo-400 hover:text-indigo-300" onClick={onClose}>
            View all notifications
          </Link>
        </div>
      </motion.div>
    </>
  );
};
