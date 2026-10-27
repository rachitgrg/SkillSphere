import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, MessageSquare, Paperclip, Phone, Send, Video } from 'lucide-react';
import { ConversationList } from '../../components/chat/ConversationList';
import { MessageBubble } from '../../components/chat/MessageBubble';
import { TypingIndicator } from '../../components/chat/TypingIndicator';
import { Avatar } from '../../components/common/Avatar';
import { Spinner } from '../../components/common/Spinner';
import { EmptyState } from '../../components/common/EmptyState';
import { useConversations } from '../../hooks/queries/useChat';
import { useConfig } from '../../hooks/queries/useConfig';
import { keys } from '../../hooks/queries/keys';
import { chatApi } from '../../api/chatApi';
import { useSocket } from '../../contexts/SocketContext';
import { useCall } from '../../contexts/CallContext';
import { useAppSelector } from '../../hooks/useRedux';
import type { Conversation, Message, MessagePage } from '../../types';
import { fullName, getErrorMessage } from '../../utils/helpers';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

type Pages = InfiniteData<MessagePage, string | undefined>;
type Ack = { ok: boolean; error?: string; message?: Message };

export function ChatPage() {
  useDocumentTitle('Messages');
  const me = useAppSelector((s) => s.auth.user)!;
  const [params, setParams] = useSearchParams();
  const activeId = params.get('c') ?? undefined;
  const conversations = useConversations();
  const { onlineUsers } = useSocket();
  const active = conversations.data?.find((c) => c._id === activeId);

  return (
    <div className="flex h-[calc(100vh-7rem)] glass-card rounded-2xl border border-slate-800 overflow-hidden">
      <aside className={`${activeId ? 'hidden md:flex' : 'flex'} w-full md:w-80 shrink-0 border-r border-slate-800`}>
        {conversations.isLoading ? (
          <div className="flex-1 flex items-center justify-center"><Spinner /></div>
        ) : (
          <ConversationList
            conversations={conversations.data ?? []}
            meId={me._id}
            activeId={activeId}
            onlineUsers={onlineUsers}
            onSelect={(id) => setParams({ c: id })}
          />
        )}
      </aside>

      <section className={`${activeId ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0`}>
        {active ? (
          <Thread key={active._id} conversation={active} meId={me._id} onBack={() => setParams({})} />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              icon={<MessageSquare className="w-8 h-8" />}
              title={conversations.data?.length ? 'Select a conversation' : 'No conversations yet'}
              description="Start a conversation from a gig, a proposal or a freelancer's profile."
            />
          </div>
        )}
      </section>
    </div>
  );
}

function Thread({ conversation, meId, onBack }: { conversation: Conversation; meId: string; onBack: () => void }) {
  const { socket, onlineUsers } = useSocket();
  const queryClient = useQueryClient();
  const other = conversation.participants.find((p) => p._id !== meId);
  const [text, setText] = useState('');
  const [otherTyping, setOtherTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fileInput = useRef<HTMLInputElement>(null);
  const { startCall, inCall } = useCall();
  const uploadsEnabled = useConfig().data?.uploads ?? false;
  const stickToBottom = useRef(true);
  const key = keys.chat.messages(conversation._id);

  const messages = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => chatApi.getMessages(conversation._id, { before: pageParam, limit: 30 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.hasMore ? last.messages[0]?._id : undefined),
  });

  // Pages are newest-first; render oldest → newest.
  const list = useMemo(() => [...(messages.data?.pages ?? [])].reverse().flatMap((p) => p.messages), [messages.data]);

  const appendMessage = (message: Message) =>
    queryClient.setQueryData<Pages>(key, (data) => {
      if (!data || data.pages.some((p) => p.messages.some((m) => m._id === message._id))) return data;
      const [newest, ...rest] = data.pages;
      return { ...data, pages: [{ ...newest, messages: [...newest.messages, message] }, ...rest] };
    });

  // Join the room (and re-join after reconnects); live events for this conversation.
  useEffect(() => {
    if (!socket) return;
    const join = () => socket.emit('join_conversation', { conversationId: conversation._id });
    join();
    socket.on('connect', join);

    const onMessage = (message: Message) => {
      if (message.conversation !== conversation._id) return;
      appendMessage(message);
      if (message.sender._id !== meId) {
        setOtherTyping(false);
        socket.emit('messages_read', { conversationId: conversation._id });
      }
    };
    const onTyping = ({ conversationId, userId }: { conversationId: string; userId: string }) =>
      conversationId === conversation._id && userId !== meId && setOtherTyping(true);
    const onStopTyping = ({ conversationId }: { conversationId: string }) => conversationId === conversation._id && setOtherTyping(false);
    const onRead = ({ conversationId, userId, readAt }: { conversationId: string; userId: string; readAt: string }) => {
      if (conversationId !== conversation._id) return;
      queryClient.setQueryData<Pages>(key, (data) =>
        data && {
          ...data,
          pages: data.pages.map((p) => ({
            ...p,
            messages: p.messages.map((m) =>
              m.sender._id === meId && !m.readBy.some((r) => r.user === userId) ? { ...m, readBy: [...m.readBy, { user: userId, readAt }] } : m
            ),
          })),
        }
      );
    };

    socket.on('message:new', onMessage);
    socket.on('typing', onTyping);
    socket.on('stop_typing', onStopTyping);
    socket.on('messages_read', onRead);
    return () => {
      socket.emit('leave_conversation', { conversationId: conversation._id });
      socket.off('connect', join);
      socket.off('message:new', onMessage);
      socket.off('typing', onTyping);
      socket.off('stop_typing', onStopTyping);
      socket.off('messages_read', onRead);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key/appendMessage derive from conversation._id
  }, [socket, conversation._id, meId]);

  // Mark as read when opened and whenever unread messages from the other side are loaded.
  const hasUnread = list.some((m) => m.sender._id !== meId && !m.readBy.some((r) => r.user === meId));
  useEffect(() => {
    if (!socket || !hasUnread) return;
    socket.emit('messages_read', { conversationId: conversation._id }, () =>
      queryClient.invalidateQueries({ queryKey: keys.chat.conversations })
    );
  }, [socket, hasUnread, conversation._id, queryClient]);

  // Keep the view pinned to the newest message unless the user scrolled up to read history.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [list.length, otherTyping]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const loadOlder = async () => {
    const el = scrollRef.current;
    const before = el?.scrollHeight ?? 0;
    stickToBottom.current = false;
    await messages.fetchNextPage();
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - before; // keep the reader's place
    });
  };

  const onType = (value: string) => {
    setText(value);
    if (!socket) return;
    socket.emit('typing', { conversationId: conversation._id });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => socket.emit('stop_typing', { conversationId: conversation._id }), 2000);
  };

  /** Emits `send_message`; resolves true when the server stored it. */
  const emitMessage = (payload: Record<string, unknown>) =>
    new Promise<boolean>((resolve) => {
      socket!.emit('send_message', { conversationId: conversation._id, ...payload }, (res: Ack) => {
        if (!res.ok) {
          toast.error(res.error ?? 'Message not sent');
          return resolve(false);
        }
        if (res.message) appendMessage(res.message);
        stickToBottom.current = true;
        queryClient.invalidateQueries({ queryKey: keys.chat.conversations });
        resolve(true);
      });
    });

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = text.trim();
    if (!content || !socket) return;
    setSending(true);
    clearTimeout(typingTimer.current);
    socket.emit('stop_typing', { conversationId: conversation._id });
    if (await emitMessage({ content })) setText('');
    setSending(false);
  };

  const sendFile = async (file: File) => {
    if (!socket) return;
    if (file.size > 10 * 1024 * 1024) return toast.error('Files must be 10 MB or smaller');
    setSending(true);
    try {
      const uploaded = await chatApi.uploadFile(conversation._id, file);
      await emitMessage({ content: uploaded.name, type: uploaded.type, fileUrl: uploaded.url, fileName: uploaded.name });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Upload failed'));
    } finally {
      setSending(false);
    }
  };

  const isOnline = other ? onlineUsers.has(other._id) : false;

  return (
    <>
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center gap-3 px-4 shrink-0">
        <button onClick={onBack} className="md:hidden p-2 text-slate-400 hover:text-white" aria-label="Back to conversations">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Avatar src={other?.avatar} firstName={other?.firstName} lastName={other?.lastName} size="sm" status={isOnline ? 'online' : undefined} />
        <div className="min-w-0">
          <h3 className="font-semibold text-white truncate">{fullName(other)}</h3>
          <p className={`text-xs ${isOnline ? 'text-emerald-400' : 'text-slate-500'}`}>
            {otherTyping ? 'typing…' : isOnline ? 'Online' : 'Offline'}
            {conversation.gig && (
              <>
                {' · '}
                <Link to={`/gigs/${conversation.gig._id}`} className="text-indigo-400 hover:underline">{conversation.gig.title}</Link>
              </>
            )}
          </p>
        </div>
        {other && (
          <div className="ml-auto flex gap-1">
            {([false, true] as const).map((video) => (
              <button
                key={String(video)}
                onClick={() => startCall(conversation._id, other, video)}
                disabled={!isOnline || inCall}
                title={isOnline ? (video ? 'Video call' : 'Voice call') : `${fullName(other)} is offline`}
                aria-label={video ? 'Start video call' : 'Start voice call'}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 focus-ring"
              >
                {video ? <Video className="w-5 h-5" /> : <Phone className="w-5 h-5" />}
              </button>
            ))}
          </div>
        )}
      </header>

      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto p-4 sm:p-6" aria-live="polite">
        {messages.hasNextPage && (
          <div className="text-center mb-4">
            <button onClick={loadOlder} disabled={messages.isFetchingNextPage} className="text-xs text-indigo-400 hover:text-indigo-300">
              {messages.isFetchingNextPage ? 'Loading…' : 'Load earlier messages'}
            </button>
          </div>
        )}
        {messages.isLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : list.length === 0 ? (
          <p className="text-center text-sm text-slate-500 py-10">Say hello 👋</p>
        ) : (
          list.map((m) => (
            <MessageBubble
              key={m._id}
              message={m}
              isOwn={m.sender._id === meId}
              isRead={Boolean(other && m.readBy.some((r) => r.user === other._id))}
            />
          ))
        )}
        {otherTyping && <TypingIndicator />}
      </div>

      <form onSubmit={send} className="p-3 sm:p-4 bg-slate-900/80 border-t border-slate-800 shrink-0 flex items-center gap-3">
        <input
          ref={fileInput}
          type="file"
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.txt,.zip"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void sendFile(file);
          }}
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={!uploadsEnabled || sending || !socket}
          title={uploadsEnabled ? 'Share a file' : 'File sharing is not configured on this server'}
          aria-label="Share a file"
          className="p-3 text-slate-400 hover:text-white disabled:opacity-40 rounded-xl"
        >
          <Paperclip className="w-5 h-5" />
        </button>
        <label htmlFor="chat-input" className="sr-only">Message</label>
        <input
          id="chat-input"
          autoComplete="off"
          value={text}
          onChange={(e) => onType(e.target.value)}
          placeholder="Type your message…"
          maxLength={5000}
          className="flex-1 bg-slate-800 border-none rounded-xl px-4 py-3 text-sm text-white focus:ring-1 focus:ring-indigo-500"
        />
        <button type="submit" disabled={!text.trim() || sending || !socket} className="p-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl transition-colors" aria-label="Send">
          <Send className="w-5 h-5" />
        </button>
      </form>
    </>
  );
}
