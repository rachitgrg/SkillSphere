import axiosInstance from './axiosInstance';

export const chatApi = {
  getConversations: () =>
    axiosInstance.get('/chat/conversations'),

  getConversation: (id: string) =>
    axiosInstance.get(`/chat/conversations/${id}`),

  createConversation: (participantId: string, gigId?: string) =>
    axiosInstance.post('/chat/conversations', { participantId, gigId }),

  getMessages: (conversationId: string, params?: { page?: number; limit?: number }) =>
    axiosInstance.get(`/chat/conversations/${conversationId}/messages`, { params }),

  sendMessage: (conversationId: string, data: { content: string; messageType?: string }) =>
    axiosInstance.post(`/chat/conversations/${conversationId}/messages`, data),

  sendFileMessage: (conversationId: string, formData: FormData) =>
    axiosInstance.post(`/chat/conversations/${conversationId}/messages/file`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  markAsRead: (conversationId: string) =>
    axiosInstance.put(`/chat/conversations/${conversationId}/read`),

  deleteMessage: (conversationId: string, messageId: string) =>
    axiosInstance.delete(`/chat/conversations/${conversationId}/messages/${messageId}`),
};
