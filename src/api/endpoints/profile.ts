import type { PaginatedResponse } from '@/api/types/api-response';
import type { JoinedGanap, JoinedGanapParams } from '../../types/profile.types';
import axiosInstance from '../axios-instance';

/**
 * API calls for current User profile activity.
 */
export const profileAPI = {
  /**
   * Lists Ganaps joined by the current User.
   *
   * @param params - Optional offset pagination.
   * @returns A paginated list of joined Ganaps.
   */
  listJoinedGanaps: (params?: JoinedGanapParams): Promise<PaginatedResponse<JoinedGanap>> =>
    axiosInstance.get<PaginatedResponse<JoinedGanap>>('/profile/me/joined-ganaps', { params }).then((res) => res.data),
};
