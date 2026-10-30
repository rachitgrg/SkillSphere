import React from 'react';
import { Bell } from 'lucide-react';
import { m } from 'framer-motion';
import { Link, useNavigate } from 'react-router';
import { Spinner } from '../common/Spinner';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '../../hooks/queries/useNotifications';
import type { Notification } from '../../types';
import { formatTimeAgo } from '../../utils/helpers';

export const NotificationDropdown: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const list = useNotifications({ limit: 8 }, isOpen);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  if (!isOpen) return null;

  const notifications = list.data?.items.notifications ?? [];
  const open = (n: Notification) => {
    if (!n.isRead) markRead.mutate(n._id);
    onClose();
    navigate(n.link || '/notifications');
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <m.div
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="absolute right-0 mt-2 w-80 sm:w-96 glass-card border border-slate-700 shadow-2xl shadow-indigo-500/10 rounded-2xl z-50 overflow-hidden"
        role="dialog"
        aria-label="Notifications"
      >
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
          <h3 className="font-semibold text-white">Notifications</h3>
          <button
            onClick={() => markAll.mutate()}
            disabled={!list.data?.items.unreadCount}
            className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-40"
          >
            Mark all as read
          </button>
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {list.isLoading ? (
            <div className="p-8 flex justify-center"><Spinner /></div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <Bell className="w-8 h-8 mx-auto mb-3 opacity-20" />
              <p>No notifications yet</p>
            </div>
          ) : (
            notifications.map((n) => (
              <button
                key={n._id}
                onClick={() => open(n)}
                className={`w-full text-left flex gap-3 p-4 hover:bg-slate-800/50 transition-colors border-b border-slate-800/50 last:border-0 ${n.isRead ? 'opacity-70' : 'bg-indigo-500/5'}`}
              >
                <span className={`mt-1.5 shrink-0 w-2 h-2 rounded-full ${n.isRead ? 'bg-transparent' : 'bg-indigo-500'}`} />
                <span>
                  <span className="block text-sm font-medium text-white">{n.title}</span>
                  <span className="block text-sm text-slate-300">{n.message}</span>
                  <span className="block text-xs text-slate-500 mt-1">{formatTimeAgo(n.createdAt)}</span>
                </span>
              </button>
            ))
          )}
        </div>

        <div className="p-3 border-t border-slate-800 text-center bg-slate-900/80">
          <Link to="/notifications" className="text-sm text-indigo-400 hover:text-indigo-300" onClick={onClose}>
            View all notifications
          </Link>
        </div>
      </m.div>
    </>
  );
};
