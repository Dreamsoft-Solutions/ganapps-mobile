import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'ganapps_access_token';
const REFRESH_TOKEN_KEY = 'ganapps_refresh_token';
const EXPIRES_AT_KEY = 'ganapps_expires_at';

/**
 * Encrypted token storage backed by expo-secure-store.
 *
 * Stores access token, refresh token, and expiry timestamp
 * in the device keychain (iOS) / keystore (Android).
 */
export const secureStorage = {
  async setTokens(accessToken: string, refreshToken: string, expiresIn: number): Promise<void> {
    const expiresAt = Date.now() + expiresIn * 1000;
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    await SecureStore.setItemAsync(EXPIRES_AT_KEY, String(expiresAt));
  },

  async getAccessToken(): Promise<string | null> {
    return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  },

  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  },

  async getExpiresAt(): Promise<number | null> {
    const value = await SecureStore.getItemAsync(EXPIRES_AT_KEY);
    return value ? Number(value) : null;
  },

  async clearTokens(): Promise<void> {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(EXPIRES_AT_KEY);
  },
};
