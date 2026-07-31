import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { ganapsAPI } from '@/api/endpoints/ganaps';
import type { GanapListResponse, PublicGanapListQuery } from '@/types/ganap.types';

export const ganapsQueryKeys = {
  all: ['ganaps'] as const,
  publicList: (query?: PublicGanapListQuery) => [...ganapsQueryKeys.all, 'public', query ?? {}] as const,
};

/**
 * Fetches the public Ganap discovery list.
 *
 * @param query - Optional search/tag/limit filters.
 * @returns TanStack query result wrapping the paginated Ganap list.
 */
export function useGanapsQuery(query?: PublicGanapListQuery): UseQueryResult<GanapListResponse, Error> {
  return useQuery<GanapListResponse, Error>({
    queryKey: ganapsQueryKeys.publicList(query),
    queryFn: () => ganapsAPI.listPublic(query),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });
}
