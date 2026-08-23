/** Platforms supported by the push-token API. */
export type PushTokenPlatform = 'android' | 'ios';

/** Request body used when associating a device push token with the current User. */
export interface RegisterPushTokenRequest {
  token: string;
  platform: PushTokenPlatform;
}

/** Response returned after registering a push token. */
export interface RegisterPushTokenResponse {
  registered: boolean;
}

/** Response returned after revoking the current User's push tokens. */
export interface RevokePushTokensResponse {
  revoked: number;
}
