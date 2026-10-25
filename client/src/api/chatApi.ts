import axiosInstance from './axiosInstance';
import { data, toParams } from './request';
import type { ApiResponse, Conversation, MessagePage } from '../types';

/** History over REST; sending, typing and read receipts go over the socket. */
export const chatApi = {
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
