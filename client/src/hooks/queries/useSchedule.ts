import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { scheduleApi } from '../../api/scheduleApi';

export const scheduleKeys = {
  all: ['schedule'] as const,
  availability: (freelancerId: string, from: string, to: string) => ['schedule', 'availability', freelancerId, from, to] as const,
  bookings: (params: object) => ['schedule', 'bookings', params] as const,
};

export const useAvailability = (freelancerId: string | undefined, from: string, to: string) =>
  useQuery({
    queryKey: scheduleKeys.availability(freelancerId ?? '', from, to),
    queryFn: () => scheduleApi.getAvailability(freelancerId!, { from, to }),
    enabled: Boolean(freelancerId),
  });

export const useBookings = (params: { from?: string; to?: string } = {}) =>
  useQuery({ queryKey: scheduleKeys.bookings(params), queryFn: () => scheduleApi.getBookings(params) });

/** Any scheduling change refreshes availability and booking lists (and profiles for slot edits). */
export const useScheduleMutation = <TInput, TResult>(mutationFn: (input: TInput) => Promise<TResult>) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => Promise.all([queryClient.invalidateQueries({ queryKey: scheduleKeys.all }), queryClient.invalidateQueries({ queryKey: ['users'] })]),
  });
};
