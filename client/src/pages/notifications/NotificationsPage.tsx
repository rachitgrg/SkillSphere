import { useState } from 'react';
import { useNavigate } from 'react-router';
import toast from 'react-hot-toast';
import { Bell, Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { QueryState } from '../../components/common/QueryState';
import { StatusTabs } from '../../components/common/StatusTabs';
import { Pagination } from '../../components/common/Pagination';
import { Button } from '../../components/common/Button';
import {
  useDeleteNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '../../hooks/queries/useNotifications';
import type { Notification } from '../../types';
import { formatTimeAgo, getErrorMessage } from '../../utils/helpers';

export function NotificationsPage() {
  const navigate = useNavigate();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const list = useNotifications({ page, limit: 20, unread: unreadOnly || undefined });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const remove = useDeleteNotification();
  const items = list.data?.items.notifications ?? [];

  const open = (n: Notification) => {
    if (!n.isRead) markRead.mutate(n._id);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Notifications"
        description={list.data ? `${list.data.items.unreadCount} unread` : undefined}
        actions={
          <Button size="sm" variant="secondary" onClick={() => markAll.mutate()} disabled={!list.data?.items.unreadCount} isLoading={markAll.isPending}>
            Mark all as read
          </Button>
        }
      />
      <StatusTabs
        label="Filter notifications"
        value={unreadOnly ? 'unread' : 'all'}
        onChange={(v) => {
          setUnreadOnly(v === 'unread');
          setPage(1);
        }}
        tabs={[{ value: 'all', label: 'All' }, { value: 'unread', label: 'Unread' }]}
      />
      <QueryState
        isLoading={list.isLoading}
        isError={list.isError}
        error={list.error}
        onRetry={() => list.refetch()}
        isEmpty={!items.length}
        empty={{ icon: <Bell className="w-8 h-8" />, title: unreadOnly ? 'All caught up' : 'No notifications yet', description: 'Proposals, payments, reviews and approvals appear here in real time.' }}
      >
        <ul className="glass-card rounded-2xl border border-slate-800 divide-y divide-slate-800 overflow-hidden">
          {items.map((n) => (
            <li key={n._id} className={`flex items-start gap-3 p-4 ${n.isRead ? '' : 'bg-indigo-500/5'}`}>
              <span className={`mt-2 shrink-0 w-2 h-2 rounded-full ${n.isRead ? 'bg-transparent' : 'bg-indigo-500'}`} aria-label={n.isRead ? undefined : 'Unread'} />
              <button onClick={() => open(n)} className="flex-1 text-left min-w-0">
                <span className="block text-sm font-medium text-white">{n.title}</span>
                <span className="block text-sm text-slate-300">{n.message}</span>
                <span className="block text-xs text-slate-500 mt-1">{formatTimeAgo(n.createdAt)}</span>
              </button>
              <button
                aria-label="Delete notification"
                onClick={() => remove.mutate(n._id, { onError: (e) => toast.error(getErrorMessage(e)) })}
                className="p-2 text-slate-500 hover:text-red-400"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
        {list.data && (
          <div className="mt-6">
            <Pagination currentPage={page} totalPages={list.data.pagination.pages} onPageChange={setPage} />
          </div>
        )}
      </QueryState>
    </div>
  );
}
