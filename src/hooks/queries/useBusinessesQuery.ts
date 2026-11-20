import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { businessesAPI } from '@/api/endpoints/businesses';
import { useAuthStore } from '@/store/auth.store';
import type { BusinessDetail, PublicBusinessProfile } from '@/types/business.types';
import type { ParsedApiError } from '@/utils/error-handling';
import { isValidBusinessShareSlug } from '@/utils/share-links';

/** Query keys for read-only Business profile data. */
export const businessQueryKeys = {
  all: ['businesses'] as const,
  details: () => [...businessQueryKeys.all, 'detail'] as const,
  detail: (businessId: string) => [...businessQueryKeys.details(), businessId] as const,
  publicSlug: (slug: string) => [...businessQueryKeys.all, 'public-slug', slug] as const,
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

/**
 * Resolves a shared Business slug to its public profile.
 *
 * A 404 is final, so it is never retried; other failures retry once.
 *
 * @param slug - Slug from the share link, or undefined when the route has none.
 * @returns The public Business profile query result.
 */
export function usePublicBusinessQuery(slug: string | undefined): UseQueryResult<PublicBusinessProfile, Error> {
  const token = useAuthStore((state) => state.token);

  return useQuery<PublicBusinessProfile, Error>({
    queryKey: businessQueryKeys.publicSlug(slug ?? ''),
    queryFn: (): Promise<PublicBusinessProfile> => businessesAPI.getPublicBySlug(slug ?? ''),
    staleTime: 5 * 60 * 1000,
    retry: (failureCount: number, error: Error): boolean =>
      (error as ParsedApiError).status !== 404 && failureCount < 1,
    enabled: Boolean(token && slug && isValidBusinessShareSlug(slug)),
  });
}
