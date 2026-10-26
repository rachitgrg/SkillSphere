import { useQuery } from '@tanstack/react-query';
import { configApi } from '../../api/configApi';
import { keys } from './keys';

/** Which optional integrations (uploads, payments, AI, Google) the server has configured. */
export const useConfig = () => useQuery({ queryKey: keys.config, queryFn: configApi.get, staleTime: 5 * 60_000 });
