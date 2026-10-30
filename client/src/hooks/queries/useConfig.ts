import { useQuery } from '@tanstack/react-query';
import { configApi } from '../../api/configApi';
import { keys } from './keys';

/** Which optional integrations (uploads, payments, AI, Google) the server has configured. */
export const useConfig = () => useQuery({ queryKey: keys.config, queryFn: configApi.get, staleTime: 5 * 60_000 });

/** Live platform counts for the landing page (cached on the server for 10 minutes). */
export const usePlatformStats = () => useQuery({ queryKey: keys.platformStats, queryFn: configApi.stats, staleTime: 5 * 60_000 });
