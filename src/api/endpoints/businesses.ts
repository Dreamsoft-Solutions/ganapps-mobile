import type { BusinessDetail } from '@/types/business.types';
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
};
