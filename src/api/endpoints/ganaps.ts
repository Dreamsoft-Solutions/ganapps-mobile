import type { Ganap, GanapListResponse, PublicGanapListQuery } from '@/types/ganap.types';
import axiosInstance from '../axios-instance';

/**
 * Public Ganap discovery endpoints.
 *
 * All paths are version-free; the axios instance already prefixes `/api/v1`.
 */
export const ganapsAPI = {
  /**
   * Lists published, upcoming Ganaps with optional search and tag filters.
   *
   * @param query - Pagination, search, and tag filters.
   * @returns A paginated list of Ganaps.
   */
  listPublic: (query?: PublicGanapListQuery): Promise<GanapListResponse> =>
    axiosInstance.get<GanapListResponse>('/ganaps', { params: query }).then((res) => res.data),

  /**
   * Fetches a single Ganap by ID.
   *
   * @param ganapId - The Ganap ID.
   * @returns The Ganap details.
   */
  getById: (ganapId: string): Promise<Ganap> => axiosInstance.get<Ganap>(`/ganaps/${ganapId}`).then((res) => res.data),
};
