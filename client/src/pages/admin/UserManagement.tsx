import React from 'react';
import { Search, Filter, MoreVertical } from 'lucide-react';
import { Badge } from '../../components/common/Badge';

export const UserManagement: React.FC = () => {
  const users = [
    { id: 1, name: 'Alex Developer', email: 'alex@example.com', role: 'Freelancer', status: 'Active', joined: '2023-01-15' },
    { id: 2, name: 'TechCorp Inc', email: 'contact@techcorp.com', role: 'Client', status: 'Active', joined: '2023-03-22' },
    { id: 3, name: 'Jane Designer', email: 'jane@example.com', role: 'Freelancer', status: 'Suspended', joined: '2023-05-10' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">User Management</h1>
      </div>

      <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search users..." className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 pl-10 pr-4 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none" />
          </div>
          <button className="flex items-center gap-2 text-sm text-slate-300 bg-slate-900 border border-slate-700 px-4 py-2 rounded-lg hover:bg-slate-800">
            <Filter className="w-4 h-4" /> Filter
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/50 border-b border-slate-800 text-sm font-medium text-slate-400">
                <th className="p-4">User</th>
                <th className="p-4">Role</th>
                <th className="p-4">Status</th>
                <th className="p-4">Joined</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                  <td className="p-4">
                    <div className="font-medium text-white">{user.name}</div>
                    <div className="text-xs text-slate-500">{user.email}</div>
                  </td>
                  <td className="p-4 text-sm text-slate-300">{user.role}</td>
                  <td className="p-4">
                    <Badge className={user.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}>
                      {user.status}
                    </Badge>
                  </td>
                  <td className="p-4 text-sm text-slate-400">{user.joined}</td>
                  <td className="p-4">
                    <button className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
