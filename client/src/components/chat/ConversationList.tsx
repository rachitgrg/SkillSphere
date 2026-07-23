import React from 'react';
import { Avatar } from '../common/Avatar';

export const ConversationList: React.FC<{
  conversations: any[];
  activeId?: string;
  onSelect: (id: string) => void;
}> = ({ conversations, activeId, onSelect }) => {
  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800 w-full md:w-80 overflow-y-auto">
      <div className="p-4 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
        <h2 className="text-xl font-bold text-white mb-4">Messages</h2>
        <input 
          type="text" 
          placeholder="Search messages..." 
          className="w-full bg-slate-800 border-none rounded-lg px-4 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500"
        />
      </div>
      
      <div className="flex-1">
        {conversations.map((chat) => (
          <div 
            key={chat.id}
            onClick={() => onSelect(chat.id)}
            className={`p-4 flex items-center gap-3 cursor-pointer transition-colors border-b border-slate-800/50 hover:bg-slate-800 ${activeId === chat.id ? 'bg-slate-800' : ''}`}
          >
            <div className="relative">
              <Avatar src={chat.user?.avatar} size="md" />
              {chat.isOnline && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full"></div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline mb-1">
                <h4 className="text-sm font-semibold text-white truncate">{chat.user?.name || 'User'}</h4>
                <span className="text-[10px] text-slate-500">{chat.lastMessageTime || '12:30 PM'}</span>
              </div>
              <p className="text-xs text-slate-400 truncate">{chat.lastMessage || 'Hello, are you available?'}</p>
            </div>
            {chat.unreadCount > 0 && (
              <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] font-bold text-white">
                {chat.unreadCount}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
