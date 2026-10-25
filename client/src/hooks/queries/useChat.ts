import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { chatApi } from '../../api/chatApi';
import { keys } from './keys';

export const useConversations = (enabled = true) =>
  useQuery({ queryKey: keys.chat.conversations, queryFn: chatApi.getConversations, enabled });

/** Opens (or reuses) a conversation; callers usually navigate to `/chat?c=<id>`. */
export const useStartConversation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ participantId, gigId }: { participantId: string; gigId?: string }) =>
      chatApi.startConversation(participantId, gigId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.chat.conversations }),
  });
};
