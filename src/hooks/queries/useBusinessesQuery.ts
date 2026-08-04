import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { businessesAPI } from '@/api/endpoints/businesses';
import { useAuthStore } from '@/store/auth.store';
import type { BusinessDetail } from '@/types/business.types';

/** Query keys for read-only Business profile data. */
export const businessQueryKeys = {
  all: ['businesses'] as const,
  details: () => [...businessQueryKeys.all, 'detail'] as const,
  detail: (businessId: string) => [...businessQueryKeys.details(), businessId] as const,
};

/**
 * Fetches organizer details without owning the parent Event Details state.
 *
 * @param businessId - Business id, or undefined before Ganap detail resolves.
 * @returns The independent Business query result.
 */
export function useBusinessDetailQuery(businessId?: string): UseQueryResult<BusinessDetail, Error> {
  const token = useAuthStore((state) => state.token);

  return useQuery<BusinessDetail, Error>({
    queryKey: businessQueryKeys.detail(businessId ?? ''),
    queryFn: (): Promise<BusinessDetail> => businessesAPI.getById(businessId ?? ''),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    enabled: Boolean(token && businessId),
  });
}
