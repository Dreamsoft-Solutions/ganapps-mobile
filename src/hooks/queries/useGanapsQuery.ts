import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { ganapsAPI } from '@/api/endpoints/ganaps';
import { useAuthStore } from '@/store/auth.store';
import type { GanapDetail } from '@/types/ganap.types';

export const ganapQueryKeys = {
  all: ['ganaps'] as const,
  list: (filters?: { search?: string; tag?: string }) => [...ganapQueryKeys.all, 'list', filters ?? {}] as const,
  detail: (ganapId: string) => [...ganapQueryKeys.all, 'detail', ganapId] as const,
};

/**
 * Fetches one Ganap's detail.
 *
 * @param ganapId - Id of the Ganap; the query stays idle while this is empty
 * @returns The TanStack query result for the Ganap detail
 */
export function useGanapDetailQuery(ganapId: string): UseQueryResult<GanapDetail, Error> {
  const token = useAuthStore((s) => s.token);

  return useQuery<GanapDetail, Error>({
    queryKey: ganapQueryKeys.detail(ganapId),
    queryFn: () => ganapsAPI.getById(ganapId),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    enabled: !!ganapId && !!token,
  });
}
