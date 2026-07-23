import React from 'react';

export const MessageBubble: React.FC<{ message: any; isOwn: boolean }> = ({ message, isOwn }) => {
  return (
    <div className={`flex flex-col max-w-[75%] ${isOwn ? 'items-end ml-auto' : 'items-start mr-auto'} mb-4`}>
      <div className={`px-4 py-2 rounded-2xl ${
        isOwn 
          ? 'bg-indigo-600 text-white rounded-br-sm' 
          : 'bg-slate-800 text-slate-200 rounded-bl-sm border border-slate-700'
      }`}>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
      </div>
      <span className="text-[10px] text-slate-500 mt-1 mx-1">
        {message.time || '12:00 PM'} {isOwn && (message.status === 'read' ? '✓✓' : '✓')}
      </span>
    </div>
  );
};
