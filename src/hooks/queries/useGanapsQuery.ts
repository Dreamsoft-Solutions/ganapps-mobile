import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { ganapsAPI } from '@/api/endpoints/ganaps';
import { useAuthStore } from '@/store/auth.store';
import type { FormBlock, FormBlockScope, GanapDetail } from '@/types/ganap.types';

export interface GanapListFilters {
  search?: string;
  tag?: string;
  lat?: number;
  long?: number;
  radius?: number;
}

export const ganapQueryKeys = {
  all: ['ganaps'] as const,
  lists: () => [...ganapQueryKeys.all, 'list'] as const,
  list: (filters?: GanapListFilters) => [...ganapQueryKeys.lists(), filters ?? {}] as const,
  infiniteList: (filters?: GanapListFilters) => [...ganapQueryKeys.lists(), 'infinite', filters ?? {}] as const,
  detail: (ganapId: string) => [...ganapQueryKeys.all, 'detail', ganapId] as const,
  formBlocks: (ganapId: string, scope: FormBlockScope) =>
    [...ganapQueryKeys.detail(ganapId), 'form-blocks', scope] as const,
  announcements: (ganapId: string) => [...ganapQueryKeys.detail(ganapId), 'announcements', 'user'] as const,
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

/**
 * Fetches the organizer-defined form blocks for one scope of a Ganap's forms.
 *
 * The endpoint carries no membership guard, so an attendee may read either
 * scope. An empty array means the organizer built no form for that scope.
 *
 * @param ganapId - Id of the Ganap; the query stays idle while this is empty
 * @param scope - Which organizer form to read
 * @returns The TanStack query result for that scope's form blocks
 */
export function useFormBlocksQuery(ganapId: string, scope: FormBlockScope): UseQueryResult<FormBlock[], Error> {
  const token = useAuthStore((s) => s.token);

  return useQuery<FormBlock[], Error>({
    queryKey: ganapQueryKeys.formBlocks(ganapId, scope),
    queryFn: (): Promise<FormBlock[]> => ganapsAPI.listFormBlocks(ganapId, scope),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    enabled: !!ganapId && !!token,
  });
}
