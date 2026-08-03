import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { ganapsAPI } from '@/api/endpoints/ganaps';
import { useAuthStore } from '@/store/auth.store';
import type { FormBlock, FormBlockScope, GanapDetail } from '@/types/ganap.types';

export const ganapQueryKeys = {
  all: ['ganaps'] as const,
  lists: () => [...ganapQueryKeys.all, 'list'] as const,
  list: (filters?: { search?: string; tag?: string }) => [...ganapQueryKeys.lists(), filters ?? {}] as const,
  infiniteList: (filters?: { search?: string; tag?: string }) =>
    [...ganapQueryKeys.lists(), 'infinite', filters ?? {}] as const,
  detail: (ganapId: string) => [...ganapQueryKeys.all, 'detail', ganapId] as const,
  formBlocks: (ganapId: string, scope: FormBlockScope) =>
    [...ganapQueryKeys.detail(ganapId), 'form-blocks', scope] as const,
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
 * Fetches the organizer-defined form blocks for a Ganap's registration form.
 *
 * @param ganapId - Id of the Ganap; the query stays idle while this is empty
 * @returns The TanStack query result for registration form blocks
 */
export function useRegistrationFormBlocksQuery(ganapId: string): UseQueryResult<FormBlock[], Error> {
  const token = useAuthStore((s) => s.token);

  return useQuery<FormBlock[], Error>({
    queryKey: ganapQueryKeys.formBlocks(ganapId, 'REGISTRATION'),
    queryFn: (): Promise<FormBlock[]> => ganapsAPI.listFormBlocks(ganapId, 'REGISTRATION'),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    enabled: !!ganapId && !!token,
  });
}
