import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { gigApi } from '../../api/gigApi';
import { paymentApi } from '../../api/paymentApi';
import { keys } from './keys';

export const useProjectProgress = (gigId: string | undefined) =>
  useQuery({ queryKey: keys.gigs.progress(gigId ?? ''), queryFn: () => gigApi.getProgress(gigId!), enabled: Boolean(gigId), retry: false });

export const usePaymentConfig = () => useQuery({ queryKey: keys.payments.config, queryFn: paymentApi.getConfig, staleTime: 5 * 60_000 });

/** Project mutations refresh the project, gig lists, payments and notifications. */
export const useProjectMutation = <TInput, TResult>(mutationFn: (input: TInput) => Promise<TResult>) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.gigs.all }),
        queryClient.invalidateQueries({ queryKey: keys.payments.all }),
      ]),
  });
};
