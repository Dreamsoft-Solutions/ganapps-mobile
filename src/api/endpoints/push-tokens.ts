import type { AxiosRequestConfig } from 'axios';
import type { RegisterPushTokenRequest, RegisterPushTokenResponse, RevokePushTokensResponse } from '@/types/push.types';
import axiosInstance from '../axios-instance';

/** API calls for device push-token ownership. */
export const pushTokensAPI = {
  /**
   * Registers or updates a device push token for the current User.
   *
   * @param request - Device token and native platform.
   * @returns The token registration acknowledgement.
   */
  register: (request: RegisterPushTokenRequest): Promise<RegisterPushTokenResponse> =>
    axiosInstance.post<RegisterPushTokenResponse>('/push-tokens', request).then((res) => res.data),

  /**
   * Removes all device push tokens for the current User.
   *
   * @param config - Optional request settings, such as a shorter timeout during logout.
   * @returns The token revocation count.
   */
  revoke: (config?: Pick<AxiosRequestConfig, 'timeout'>): Promise<RevokePushTokensResponse> =>
    axiosInstance.delete<RevokePushTokensResponse>('/push-tokens', config).then((res) => res.data),
};
