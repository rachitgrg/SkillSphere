import { useState } from 'react';
import toast from 'react-hot-toast';
import { Search } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { QueryState } from '../../components/common/QueryState';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Pagination } from '../../components/common/Pagination';
import { Avatar } from '../../components/common/Avatar';
import { useAdminUser, useAdminUsers, useSuspendUser, useUnsuspendUser } from '../../hooks/queries/useAdmin';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import type { User, UserRole } from '../../types';
import { formatCurrency, formatDay, fullName, getErrorMessage, GIG_STATUS_META } from '../../utils/helpers';

const selectClass = 'bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none';

const statusOf = (u: User) =>
  u.isBanned
    ? { label: u.suspendedUntil ? `Suspended until ${formatDay(u.suspendedUntil)}` : 'Suspended', variant: 'error' as const }
    : u.isActive
      ? { label: 'Active', variant: 'success' as const }
      : { label: 'Inactive', variant: 'secondary' as const };

export function UserManagement() {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<UserRole | ''>('');
  const [status, setStatus] = useState<'' | 'active' | 'suspended' | 'inactive'>('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [suspending, setSuspending] = useState<User | null>(null);
  const debounced = useDebouncedValue(search);
  const users = useAdminUsers({ search: debounced || undefined, role: role || undefined, status: status || undefined, page });
  const unsuspend = useUnsuspendUser();

  return (
    <div className="space-y-6">
      <PageHeader title="Users" description="Search accounts, review their activity and suspend abusers." />

      <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="search"
              aria-label="Search users"
              placeholder="Name or email…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 pl-10 pr-4 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none"
            />
          </div>
          <select aria-label="Role" className={selectClass} value={role} onChange={(e) => { setRole(e.target.value as UserRole | ''); setPage(1); }}>
            <option value="">All roles</option>
            <option value="client">Clients</option>
            <option value="freelancer">Freelancers</option>
            <option value="admin">Admins</option>
          </select>
          <select aria-label="Status" className={selectClass} value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setPage(1); }}>
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <QueryState isLoading={users.isLoading} isError={users.isError} error={users.error} onRetry={() => users.refetch()} isEmpty={!users.data?.items.length} empty={{ title: 'No users found', description: 'Try a different search or filter.' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/50 border-b border-slate-800 text-xs font-medium text-slate-400 uppercase tracking-wide">
                  <th className="p-4">User</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Joined</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.data?.items.map((u) => {
                  const st = statusOf(u);
                  return (
                    <tr key={u._id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                      <td className="p-4">
                        <button onClick={() => setSelected(u._id)} className="flex items-center gap-3 text-left">
                          <Avatar src={u.avatar} firstName={u.firstName} lastName={u.lastName} size="sm" />
                          <span>
                            <span className="block font-medium text-white hover:text-indigo-400">{fullName(u)}</span>
                            <span className="block text-xs text-slate-500">{u.email}</span>
                          </span>
                        </button>
                      </td>
                      <td className="p-4 text-sm text-slate-300 capitalize">{u.role}</td>
                      <td className="p-4"><Badge variant={st.variant}>{st.label}</Badge></td>
                      <td className="p-4 text-sm text-slate-400">{formatDay(u.createdAt)}</td>
                      <td className="p-4 text-right">
                        {u.role !== 'admin' &&
                          (u.isBanned ? (
                            <Button size="sm" variant="secondary" isLoading={unsuspend.isPending && unsuspend.variables === u._id}
                              onClick={() => unsuspend.mutate(u._id, { onSuccess: () => toast.success('Suspension lifted'), onError: (e) => toast.error(getErrorMessage(e)) })}>
                              Unsuspend
                            </Button>
                          ) : (
                            <Button size="sm" variant="danger" onClick={() => setSuspending(u)}>Suspend</Button>
                          ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {users.data && <div className="p-4"><Pagination currentPage={page} totalPages={users.data.pagination.pages} onPageChange={setPage} /></div>}
        </QueryState>
      </div>

      <UserDetailsModal id={selected} onClose={() => setSelected(null)} />
      {suspending && <SuspendModal user={suspending} onClose={() => setSuspending(null)} />}
    </div>
  );
}

function SuspendModal({ user, onClose }: { user: User; onClose: () => void }) {
  const suspend = useSuspendUser();
  const [reason, setReason] = useState('');
  const [days, setDays] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 3) return toast.error('Give a reason');
    try {
      await suspend.mutateAsync({ id: user._id, reason: reason.trim(), durationDays: days ? Number(days) : undefined });
      toast.success(`${fullName(user)} suspended`);
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Suspend ${fullName(user)}?`} size="sm">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-400">They are signed out everywhere and can&apos;t log in until the suspension ends.</p>
        <div>
          <label htmlFor="suspend-reason" className="block text-sm font-medium text-dark-300 mb-1.5">Reason</label>
          <textarea id="suspend-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
        </div>
        <div>
          <label htmlFor="suspend-days" className="block text-sm font-medium text-dark-300 mb-1.5">Duration</label>
          <select id="suspend-days" value={days} onChange={(e) => setDays(e.target.value)} className={`${selectClass} w-full`}>
            <option value="">Until lifted manually</option>
            <option value="1">1 day</option>
            <option value="7">7 days</option>
            <option value="30">30 days</option>
          </select>
        </div>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="danger" isLoading={suspend.isPending}>Suspend</Button>
        </div>
      </form>
    </Modal>
  );
}

function UserDetailsModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  const details = useAdminUser(id);
  const d = details.data;
  return (
    <Modal isOpen={Boolean(id)} onClose={onClose} title={d ? fullName(d.user) : 'User'} size="lg">
      <QueryState isLoading={details.isLoading} isError={details.isError} error={details.error}>
        {d && (
          <div className="space-y-5 text-sm">
            <p className="text-slate-400">{d.user.email} · {d.user.role} · joined {formatDay(d.user.createdAt)}{d.user.banReason ? ` · suspended: ${d.user.banReason}` : ''}</p>
            {[
              { title: 'Gigs', rows: d.gigs.map((g) => [g.title, GIG_STATUS_META[g.status].label]) },
              { title: 'Payments', rows: d.payments.map((p) => [formatDay(p.createdAt), `${formatCurrency(p.amount)} · ${p.status}`]) },
              { title: 'Reviews', rows: d.reviews.map((r) => [`${r.rating.toFixed(1)}★ ${r.comment.slice(0, 60)}`, r.isFlagged ? 'flagged' : r.isVisible ? 'visible' : 'hidden']) },
              { title: 'Disputes', rows: d.disputes.map((x) => [x.title, x.status]) },
            ].map((section) => (
              <section key={section.title}>
                <h3 className="font-semibold text-white mb-2">{section.title} ({section.rows.length})</h3>
                {section.rows.length ? (
                  <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800">
                    {section.rows.map(([a, b], i) => (
                      <li key={i} className="flex justify-between gap-3 px-3 py-2"><span className="text-slate-300 truncate">{a}</span><span className="text-slate-500 shrink-0 capitalize">{b}</span></li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-500">None.</p>
                )}
              </section>
            ))}
          </div>
        )}
      </QueryState>
    </Modal>
  );
}
