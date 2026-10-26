import axiosInstance from './axiosInstance';
import { data, toParams } from './request';
import type { ApiResponse, ChatUpload, Conversation, MessagePage } from '../types';

/** History over REST; sending, typing and read receipts go over the socket. */
export const chatApi = {
  /** Uploads one file (10 MB); send it afterwards as a socket message with the returned url. */
  uploadFile: (conversationId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return data(axiosInstance.post<ApiResponse<ChatUpload>>(`/chat/conversations/${conversationId}/files`, form));
  },

  getConversations: () => data(axiosInstance.get<ApiResponse<Conversation[]>>('/chat/conversations')),

  /** Opens (or reuses) a 1:1 conversation, optionally about a gig. */
  startConversation: (participantId: string, gigId?: string) =>
    data(axiosInstance.post<ApiResponse<Conversation>>('/chat/conversations', { participantId, gigId })),

  /** Newest page first; pass `before` (a message id) to load older messages. */
  getMessages: (conversationId: string, params?: { before?: string; limit?: number }) =>
    data(
      axiosInstance.get<ApiResponse<MessagePage>>(`/chat/conversations/${conversationId}/messages`, {
        params: toParams(params),
      })
    ),
};
