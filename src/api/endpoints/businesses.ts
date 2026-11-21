import type { BusinessDetail, PublicBusinessProfile } from '@/types/business.types';
import axiosInstance from '../axios-instance';

/** Read-only Business endpoints used by attendee surfaces. */
export const businessesAPI = {
  /**
   * Fetches one Business profile for organizer enrichment.
   *
   * @param businessId - Business identifier from Ganap detail.
   * @returns The unwrapped Business detail payload.
   */
  getById: (businessId: string): Promise<BusinessDetail> =>
    axiosInstance.get<BusinessDetail>(`/businesses/${businessId}`).then((res) => res.data),

  /**
   * Fetches a public Business profile by its share slug.
   *
   * @param slug - Business share slug from a `/businesses/<slug>` link.
   * @returns The unwrapped public Business profile.
   */
  getPublicBySlug: (slug: string): Promise<PublicBusinessProfile> =>
    axiosInstance.get<PublicBusinessProfile>(`/businesses/public/${encodeURIComponent(slug)}`).then((res) => res.data),
};
