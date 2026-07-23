import React from 'react';
import { ConversationList } from '../../components/chat/ConversationList';
import { MessageBubble } from '../../components/chat/MessageBubble';
import { TypingIndicator } from '../../components/chat/TypingIndicator';
import { Send, Paperclip, MoreVertical, Phone, Video } from 'lucide-react';
import { Avatar } from '../../components/common/Avatar';

export const ChatPage: React.FC = () => {
  return (
    <div className="flex h-[calc(100vh-4rem)] bg-slate-950 overflow-hidden">
      <ConversationList 
        activeId="1"
        conversations={[
          { id: '1', user: { name: 'Sarah Manager', avatar: 'https://i.pravatar.cc/150?u=a04258114e29026702d' }, lastMessage: 'That looks great! When can you deploy?', lastMessageTime: '10:45 AM', isOnline: true, unreadCount: 2 },
          { id: '2', user: { name: 'TechCorp HR' }, lastMessage: 'We would like to schedule an interview.', lastMessageTime: 'Yesterday', isOnline: false, unreadCount: 0 }
        ]} 
        onSelect={() => {}} 
      />
      
      <div className="flex-1 flex flex-col h-full bg-slate-950">
        <div className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            <Avatar src="https://i.pravatar.cc/150?u=a04258114e29026702d" size="sm" />
            <div>
              <h3 className="font-semibold text-white">Sarah Manager</h3>
              <p className="text-xs text-emerald-400">Online</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <button className="hover:text-white transition-colors"><Phone className="w-5 h-5" /></button>
            <button className="hover:text-white transition-colors"><Video className="w-5 h-5" /></button>
            <button className="hover:text-white transition-colors"><MoreVertical className="w-5 h-5" /></button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <MessageBubble message={{ content: 'Hi, I have reviewed the wireframes.', time: '10:30 AM', status: 'read' }} isOwn={false} />
          <MessageBubble message={{ content: 'Great! Are there any changes needed before I start coding?', time: '10:35 AM', status: 'read' }} isOwn={true} />
          <MessageBubble message={{ content: 'No, they look perfect. You can proceed with the development.', time: '10:40 AM', status: 'read' }} isOwn={false} />
          <MessageBubble message={{ content: 'Awesome, I will get started right away.', time: '10:42 AM', status: 'read' }} isOwn={true} />
          <MessageBubble message={{ content: 'That looks great! When can you deploy?', time: '10:45 AM' }} isOwn={false} />
          <TypingIndicator />
        </div>
        
        <div className="p-4 bg-slate-900/80 border-t border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <button className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors">
              <Paperclip className="w-5 h-5" />
            </button>
            <input 
              type="text" 
              placeholder="Type your message..." 
              className="flex-1 bg-slate-800 border-none rounded-xl px-4 py-3 text-sm text-white focus:ring-1 focus:ring-indigo-500"
            />
            <button className="p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-colors">
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
