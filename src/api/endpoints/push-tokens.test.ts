import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import axiosInstance from '../axios-instance';
import { pushTokensAPI } from './push-tokens';

let captured: AxiosRequestConfig[] = [];

/**
 * Builds an adapter that records requests and returns the server envelope.
 *
 * @param payload - Inner response payload.
 * @returns A fake Axios adapter.
 */
function envelopeAdapter(payload: unknown): (config: AxiosRequestConfig) => Promise<AxiosResponse> {
  return async (config: AxiosRequestConfig): Promise<AxiosResponse> => {
    captured.push(config);
    return {
      data: { success: true, statusCode: 200, data: payload, message: 'Success' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: config as AxiosResponse['config'],
    };
  };
}

/**
 * Returns the complete URL captured by the fake adapter.
 *
 * @param config - Captured Axios request.
 * @returns Resolved request URL.
 */
function requestedUrl(config: AxiosRequestConfig): string {
  return `${config.baseURL ?? ''}${config.url ?? ''}`;
}

/**
 * Reads a transformed JSON request body without coupling the assertion to Axios transforms.
 *
 * @param config - Captured Axios request.
 * @returns Parsed request body.
 */
function requestBody(config: AxiosRequestConfig): unknown {
  return typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
}

beforeEach((): void => {
  captured = [];
});

afterEach((): void => {
  axiosInstance.defaults.adapter = undefined;
});

describe('pushTokensAPI', (): void => {
  it('posts the Android token to the versioned push-token path', async (): Promise<void> => {
    axiosInstance.defaults.adapter = envelopeAdapter(null);

    await pushTokensAPI.register({ token: 'fcm-token', platform: 'android' });

    expect(captured[0].method).toBe('post');
    expect(requestedUrl(captured[0])).toContain('/api/v1/push-tokens');
    expect(requestBody(captured[0])).toEqual({ token: 'fcm-token', platform: 'android' });
  });

  it('deletes all current-user tokens through the versioned path', async (): Promise<void> => {
    axiosInstance.defaults.adapter = envelopeAdapter({ revoked: 1 });

    await pushTokensAPI.revoke();

    expect(captured[0].method).toBe('delete');
    expect(requestedUrl(captured[0])).toContain('/api/v1/push-tokens');
    expect(captured[0].data).toBeUndefined();
  });

  it('returns the unwrapped response payload', async (): Promise<void> => {
    axiosInstance.defaults.adapter = envelopeAdapter({ registered: true });

    await expect(pushTokensAPI.register({ token: 'fcm-token', platform: 'android' })).resolves.toEqual({
      registered: true,
    });
  });
});
