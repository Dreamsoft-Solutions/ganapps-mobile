import axiosInstance from '@/api/axios-instance';
import type {
  FriendCode,
  FriendGoingRecord,
  FriendPage,
  FriendPresenceResponse,
  FriendProfile,
  FriendRequestDirection,
  FriendRequestItem,
  FriendRequestResult,
  FriendSettings,
  FriendUserSummary,
} from '@/types/friends.types';
import { normalizeFriendCode } from '@/utils/friends';

/** Cursor and page-size parameters shared by Friends list endpoints. */
export interface FriendsListParams {
  cursor?: string;
  limit?: number;
}

/** Optional event focus for the privacy-filtered Going feed. */
export interface FriendGoingParams extends FriendsListParams {
  ganapId?: string;
}

/** Parameters for the one bounded active-friend presence sample. */
export interface FriendPresenceParams {
  screenSession?: string;
  limit?: number;
}

/** Partial global visibility update accepted by the server. */
export type FriendSettingsUpdate = Partial<FriendSettings>;

/** Friend Code payload accepted by the create-request endpoint. */
export interface CreateFriendRequestInput {
  friendCode: string;
}

/** Typed social-graph HTTP endpoints. Paths intentionally omit `/api/v1`. */
export const friendsAPI = {
  /**
   * Lazily reads or creates the current User's Friend Code.
   *
   * @returns Server-issued Friend Code and issue timestamp
   */
  getCode: (): Promise<FriendCode> => axiosInstance.get<FriendCode>('/friends/code').then((res) => res.data),

  /**
   * Replaces the current User's Friend Code.
   *
   * @returns Newly-issued Friend Code and issue timestamp
   */
  regenerateCode: (): Promise<FriendCode> =>
    axiosInstance.post<FriendCode>('/friends/code/regenerate').then((res) => res.data),

  /**
   * Looks up one eligible User by Friend Code.
   *
   * @param code - Raw or grouped Friend Code
   * @returns Server-filtered safe target summary
   */
  lookup: (code: string): Promise<FriendUserSummary> =>
    axiosInstance
      .get<FriendUserSummary>('/friends/lookup', { params: { code: normalizeFriendCode(code) } })
      .then((res) => res.data),

  /**
   * Creates a request or receives the server's cross-request auto-accept result.
   *
   * @param input - Raw Friend Code; presentation separators are normalized before transport
   * @returns Server-owned request attempt result
   */
  createRequest: (input: CreateFriendRequestInput | string): Promise<FriendRequestResult> => {
    const friendCode: string = normalizeFriendCode(typeof input === 'string' ? input : input.friendCode);
    return axiosInstance.post<FriendRequestResult>('/friends/requests', { friendCode }).then((res) => res.data);
  },

  /**
   * Lists pending incoming or outgoing requests using the opaque cursor.
   *
   * @param direction - Request side to read
   * @param params - Opaque cursor and bounded page size
   * @returns Server-owned request page
   */
  listRequests: (
    direction: FriendRequestDirection,
    params: FriendsListParams = {},
  ): Promise<FriendPage<FriendRequestItem>> =>
    axiosInstance
      .get<FriendPage<FriendRequestItem>>('/friends/requests', {
        params: { direction, cursor: params.cursor, limit: params.limit },
      })
      .then((res) => res.data),

  /**
   * Accepts an incoming request.
   *
   * @param attemptId - Server request-attempt identifier
   * @returns Accepted attempt, including auto-accept metadata when supplied
   */
  acceptRequest: (attemptId: string): Promise<FriendRequestResult> =>
    axiosInstance.post<FriendRequestResult>(`/friends/requests/${attemptId}/accept`).then((res) => res.data),

  /**
   * Rejects an incoming request and retains its server cooldown.
   *
   * @param attemptId - Server request-attempt identifier
   * @returns Rejected attempt and exact retry timestamp
   */
  rejectRequest: (attemptId: string): Promise<FriendRequestResult> =>
    axiosInstance.post<FriendRequestResult>(`/friends/requests/${attemptId}/reject`).then((res) => res.data),

  /**
   * Revokes an outgoing request and retains its server cooldown.
   *
   * @param attemptId - Server request-attempt identifier
   * @returns Revoked attempt and exact retry timestamp
   */
  revokeRequest: (attemptId: string): Promise<FriendRequestResult> =>
    axiosInstance.delete<FriendRequestResult>(`/friends/requests/${attemptId}`).then((res) => res.data),

  /**
   * Lists accepted, unblocked, safe friend summaries in server order.
   *
   * @param params - Opaque cursor and bounded page size
   * @returns Server-owned friend page
   */
  listFriends: (params: FriendsListParams = {}): Promise<FriendPage<FriendUserSummary>> =>
    axiosInstance
      .get<FriendPage<FriendUserSummary>>('/friends', {
        params: { cursor: params.cursor, limit: params.limit },
      })
      .then((res) => res.data),

  /**
   * Ends an accepted friendship while retaining any server-authorized Direct history.
   *
   * @param userId - Friend User identifier
   * @returns A promise resolving after the server accepts the change
   */
  unfriend: (userId: string): Promise<void> =>
    axiosInstance.delete<void>(`/friends/${userId}`).then((): undefined => undefined),

  /**
   * Reads a relationship-scoped safe profile.
   *
   * @param userId - Profile User identifier
   * @returns Server-authorized profile projection
   */
  getProfile: (userId: string): Promise<FriendProfile> =>
    axiosInstance.get<FriendProfile>(`/friends/${userId}/profile`).then((res) => res.data),

  /**
   * Returns one bounded active-friend sample for the focused Friends screen.
   *
   * @param params - Optional same-screen opaque seed and sample limit
   * @returns Safe active-friend summaries and the server's opaque session seed
   */
  listPresence: (params: FriendPresenceParams = {}): Promise<FriendPresenceResponse> =>
    axiosInstance
      .get<FriendPresenceResponse>('/friends/presence', {
        params: { screenSession: params.screenSession, limit: params.limit },
      })
      .then((res) => res.data),

  /**
   * Lists privacy-filtered upcoming and ongoing Ganap activity.
   *
   * @param params - Opaque cursor and bounded page size
   * @returns Server-owned Going page
   */
  listGoing: (params: FriendGoingParams = {}): Promise<FriendPage<FriendGoingRecord>> =>
    axiosInstance
      .get<FriendPage<FriendGoingRecord>>('/friends/going', {
        params: { cursor: params.cursor, limit: params.limit, ganapId: params.ganapId },
      })
      .then((res) => res.data),

  /**
   * Reads global visibility settings for presence and Going data.
   *
   * @returns Current server-owned visibility settings
   */
  getSettings: (): Promise<FriendSettings> =>
    axiosInstance.get<FriendSettings>('/friends/settings').then((res) => res.data),

  /**
   * Updates one or both global visibility settings.
   *
   * @param input - Partial setting update; the server requires at least one field
   * @returns Updated visibility settings
   */
  updateSettings: (input: FriendSettingsUpdate): Promise<FriendSettings> =>
    axiosInstance.patch<FriendSettings>('/friends/settings', input).then((res) => res.data),

  /**
   * Records this device's short-lived presence heartbeat.
   *
   * @param deviceId - Client-generated device identity
   * @returns A promise resolving after the heartbeat is accepted
   */
  heartbeat: (deviceId: string): Promise<void> =>
    axiosInstance.post<void>('/presence/heartbeat', { deviceId }).then((): undefined => undefined),
};

/** Backwards-readable aliases for callers that use operation-oriented names. */
export const friendAPI: typeof friendsAPI = friendsAPI;
