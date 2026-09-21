import type { PaginatedResponse } from '@/api/types/api-response';
import type { JoinedGanap, JoinedGanapParams, SavedGanap, SavedGanapParams } from '../../types/profile.types';
import axiosInstance from '../axios-instance';

/**
 * API calls for current User profile activity.
 */
export const profileAPI = {
  /**
   * Lists Ganaps joined by the current User.
   *
   * @param params - Optional offset pagination and joined-event filters.
   * @returns A paginated list of joined Ganaps.
   */
  listJoinedGanaps: (params?: JoinedGanapParams): Promise<PaginatedResponse<JoinedGanap>> =>
    axiosInstance.get<PaginatedResponse<JoinedGanap>>('/profile/me/joined-ganaps', { params }).then((res) => res.data),

  /**
   * Lists Ganaps saved by the current User.
   *
   * @param params - Optional offset pagination. The endpoint accepts no filters.
   * @returns A paginated list of saved Ganaps, most recently saved first.
   */
  listSavedGanaps: (params?: SavedGanapParams): Promise<PaginatedResponse<SavedGanap>> =>
    axiosInstance.get<PaginatedResponse<SavedGanap>>('/profile/me/saved-ganaps', { params }).then((res) => res.data),
};
