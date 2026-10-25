import React from 'react';
import { FileText } from 'lucide-react';
import type { Message } from '../../types';

/** One chat message. Own messages show ✓ (sent) or ✓✓ (read by the other participant). */
export const MessageBubble: React.FC<{ message: Message; isOwn: boolean; isRead: boolean }> = ({ message, isOwn, isRead }) => {
  const time = new Date(message.createdAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  return (
    <div className={`flex flex-col max-w-[80%] sm:max-w-[70%] ${isOwn ? 'items-end ml-auto' : 'items-start mr-auto'} mb-3`}>
      <div className={`px-4 py-2 rounded-2xl ${isOwn ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-slate-800 text-slate-200 rounded-bl-sm border border-slate-700'}`}>
        {message.type === 'image' && message.fileUrl && (
          <a href={message.fileUrl} target="_blank" rel="noreferrer">
            <img src={message.fileUrl} alt={message.fileName ?? 'Image'} className="max-h-60 rounded-lg mb-1" />
          </a>
        )}
        {message.type === 'file' && message.fileUrl && (
          <a href={message.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 underline underline-offset-2 mb-1">
            <FileText className="w-4 h-4" /> {message.fileName ?? 'Download file'}
          </a>
        )}
        {message.content && <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>}
      </div>
      <span className="text-[10px] text-slate-500 mt-1 mx-1">
        {time}
        {isOwn && <span className={isRead ? 'text-indigo-400 ml-1' : 'ml-1'} aria-label={isRead ? 'Read' : 'Sent'}>{isRead ? '✓✓' : '✓'}</span>}
      </span>
    </div>
  );
};
