import type { GanapDetail, GanapListItem, GanapListParams, JoinGanapResult } from '@/types/ganap.types';
import axiosInstance from '../axios-instance';
import type { CursorPage } from '../types/api-response';

export const ganapsAPI = {
  /**
   * Fetches a page of published Ganaps.
   *
   * @param params - Cursor, page size, and optional search or tag filters
   * @returns The page of list items with its pagination cursor
   */
  list: (params?: GanapListParams): Promise<CursorPage<GanapListItem>> =>
    axiosInstance.get<CursorPage<GanapListItem>>('/ganaps', { params }).then((res) => res.data),

  /**
   * Fetches one Ganap's full detail.
   *
   * @param ganapId - Id of the Ganap
   * @returns The Ganap, including the caller's registration when authenticated
   */
  getById: (ganapId: string): Promise<GanapDetail> =>
    axiosInstance.get<GanapDetail>(`/ganaps/${ganapId}`).then((res) => res.data),

  /**
   * Registers the current user for a Ganap. Sends no body.
   *
   * @param ganapId - Id of the Ganap to join
   * @returns The created registration, whose status the server decides
   */
  join: (ganapId: string): Promise<JoinGanapResult> =>
    axiosInstance.post<JoinGanapResult>(`/ganaps/${ganapId}/join`).then((res) => res.data),

  /**
   * Cancels the current user's registration.
   *
   * @param ganapId - Id of the Ganap to leave
   * @returns Nothing
   */
  leave: (ganapId: string): Promise<void> =>
    axiosInstance.post<void>(`/ganaps/${ganapId}/leave`).then((res) => res.data),

  /**
   * Likes a Ganap. Requires an existing registration server-side.
   *
   * @param ganapId - Id of the Ganap to like
   * @returns Nothing
   */
  like: (ganapId: string): Promise<void> => axiosInstance.post<void>(`/ganaps/${ganapId}/like`).then((res) => res.data),

  /**
   * Removes the current user's like.
   *
   * @param ganapId - Id of the Ganap to unlike
   * @returns Nothing
   */
  unlike: (ganapId: string): Promise<void> =>
    axiosInstance.delete<void>(`/ganaps/${ganapId}/like`).then((res) => res.data),

  /**
   * Saves a Ganap for later. Requires an existing registration server-side.
   *
   * @param ganapId - Id of the Ganap to save
   * @returns Nothing
   */
  save: (ganapId: string): Promise<void> => axiosInstance.post<void>(`/ganaps/${ganapId}/save`).then((res) => res.data),

  /**
   * Removes the current user's save.
   *
   * @param ganapId - Id of the Ganap to unsave
   * @returns Nothing
   */
  unsave: (ganapId: string): Promise<void> =>
    axiosInstance.delete<void>(`/ganaps/${ganapId}/save`).then((res) => res.data),
};
