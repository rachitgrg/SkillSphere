import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { Avatar } from '../common/Avatar';
import type { Conversation } from '../../types';
import { fullName } from '../../utils/helpers';

const shortTime = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

interface ConversationListProps {
  conversations: Conversation[];
  meId: string;
  activeId?: string;
  onlineUsers: Set<string>;
  onSelect: (id: string) => void;
}

export const ConversationList: React.FC<ConversationListProps> = ({ conversations, meId, activeId, onlineUsers, onSelect }) => {
  const [query, setQuery] = useState('');
  const visible = conversations.filter((c) => {
    const other = c.participants.find((p) => p._id !== meId);
    return !query || `${fullName(other)} ${c.gig?.title ?? ''}`.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <div className="flex flex-col h-full w-full">
      <div className="p-4 border-b border-slate-800">
        <h2 className="text-lg font-bold text-white mb-3">Messages</h2>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            aria-label="Search conversations"
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-slate-800 border-none rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      <ul className="flex-1 overflow-y-auto">
        {visible.map((c) => {
          const other = c.participants.find((p) => p._id !== meId);
          const active = c._id === activeId;
          return (
            <li key={c._id}>
              <button
                onClick={() => onSelect(c._id)}
                aria-current={active ? 'true' : undefined}
                className={`w-full text-left p-4 flex items-center gap-3 border-b border-slate-800/50 hover:bg-slate-800 transition-colors ${active ? 'bg-slate-800' : ''}`}
              >
                <Avatar src={other?.avatar} firstName={other?.firstName} lastName={other?.lastName} size="md" status={other && onlineUsers.has(other._id) ? 'online' : undefined} />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline gap-2">
                    <span className="text-sm font-semibold text-white truncate">{fullName(other)}</span>
                    <span className="text-[10px] text-slate-500 shrink-0">{shortTime(c.lastMessage?.createdAt ?? c.lastMessageAt)}</span>
                  </div>
                  {c.gig && <p className="text-[11px] text-indigo-400 truncate">{c.gig.title}</p>}
                  <p className={`text-xs truncate ${c.unreadCount ? 'text-slate-200 font-medium' : 'text-slate-400'}`}>
                    {c.lastMessage ? `${c.lastMessage.sender === meId ? 'You: ' : ''}${c.lastMessage.type === 'text' ? c.lastMessage.content : '📎 Attachment'}` : 'No messages yet'}
                  </p>
                </div>
                {c.unreadCount > 0 && (
                  <span className="min-w-5 h-5 px-1.5 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] font-bold text-white" aria-label={`${c.unreadCount} unread`}>
                    {c.unreadCount}
                  </span>
                )}
              </button>
            </li>
          );
        })}
        {visible.length === 0 && <li className="p-6 text-sm text-slate-500 text-center">No conversations.</li>}
      </ul>
    </div>
  );
};
