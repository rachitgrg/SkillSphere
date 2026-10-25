import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { userApi, type ClientProfileInput, type FreelancerProfileInput, type UpdateMeInput } from '../../api/userApi';
import { reviewApi } from '../../api/reviewApi';
import { useAppDispatch } from '../useRedux';
import { updateUser } from '../../store/slices/authSlice';
import { keys } from './keys';

export const useMe = (enabled = true) => useQuery({ queryKey: keys.users.me, queryFn: userApi.getMe, enabled });

export const useFreelancerProfile = (userId: string | undefined) =>
  useQuery({
    queryKey: keys.users.freelancer(userId ?? ''),
    queryFn: () => userApi.getFreelancerProfile(userId!),
    enabled: Boolean(userId),
    retry: false,
  });

export const useClientProfile = (userId: string | undefined) =>
  useQuery({
    queryKey: keys.users.client(userId ?? ''),
    queryFn: () => userApi.getClientProfile(userId!),
    enabled: Boolean(userId),
    retry: false,
  });

export const useUserReviews = (userId: string | undefined) =>
  useQuery({ queryKey: keys.reviews.forUser(userId ?? ''), queryFn: () => reviewApi.getForUser(userId!), enabled: Boolean(userId) });

export const useReviewBreakdown = (userId: string | undefined) =>
  useQuery({ queryKey: keys.reviews.breakdown(userId ?? ''), queryFn: () => reviewApi.getBreakdown(userId!), enabled: Boolean(userId) });

/** Updates account fields and mirrors them into the auth slice (navbar name/avatar). */
export const useUpdateMe = () => {
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();
  return useMutation({
    mutationFn: (input: UpdateMeInput) => userApi.updateMe(input),
    onSuccess: (user) => {
      dispatch(updateUser(user));
      return queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};

export const useUpdateFreelancerProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: FreelancerProfileInput) => userApi.updateFreelancerProfile(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
};

export const useUpdateClientProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ClientProfileInput) => userApi.updateClientProfile(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
};
