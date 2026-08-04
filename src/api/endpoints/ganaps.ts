import type {
  FormBlock,
  FormBlockScope,
  GanapAnnouncement,
  GanapAnnouncementParams,
  GanapDetail,
  GanapListItem,
  GanapListParams,
  JoinGanapResult,
  SubmitFormAnswersInput,
} from '@/types/ganap.types';
import axiosInstance from '../axios-instance';
import type { CursorPage, PaginatedResponse } from '../types/api-response';

/**
 * Public Ganap discovery and action endpoints.
 *
 * All paths are version-free; the axios instance already prefixes `/api/v1`.
 */
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
   * Fetches form blocks for a Ganap and scope.
   *
   * @param ganapId - Id of the Ganap
   * @param scope - Form scope to request
   * @returns The server-defined form blocks
   */
  listFormBlocks: (ganapId: string, scope: FormBlockScope): Promise<FormBlock[]> =>
    axiosInstance.get<FormBlock[]>(`/ganaps/${ganapId}/form-blocks`, { params: { scope } }).then((res) => res.data),

  /**
   * Submits the current user's form answers for a Ganap.
   *
   * @param ganapId - Id of the Ganap
   * @param input - Form-answer request body
   * @returns The updated server-decided registration
   */
  submitFormAnswers: (ganapId: string, input: SubmitFormAnswersInput): Promise<JoinGanapResult> =>
    axiosInstance.post<JoinGanapResult>(`/ganaps/${ganapId}/form-answers`, input).then((res) => res.data),

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

  /**
   * Fetches one offset page of attendee-facing announcements for a Ganap.
   *
   * @param ganapId - Id of the Ganap
   * @param params - Offset-pagination `skip`/`take` query params
   * @returns The paginated announcement payload, newest first
   */
  listUserAnnouncements: (
    ganapId: string,
    params: GanapAnnouncementParams,
  ): Promise<PaginatedResponse<GanapAnnouncement>> =>
    axiosInstance
      .get<PaginatedResponse<GanapAnnouncement>>(`/ganaps/${ganapId}/announcements/user`, { params })
      .then((res) => res.data),
};
