import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import type { AppleAuthRequestDto, AppleAuthResponse } from '@/types/auth.types';
import type { User } from '@/types/user.types';
import axiosInstance from '../axios-instance';
import { authAPI } from './auth';

let captured: AxiosRequestConfig[] = [];

/**
 * Builds a fake adapter that returns the server response envelope.
 *
 * @param payload - Inner response payload.
 * @returns An Axios adapter for the test instance.
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

beforeEach((): void => {
  captured = [];
});

afterEach((): void => {
  axiosInstance.defaults.adapter = undefined;
});

describe('authAPI.appleLogin', (): void => {
  it('posts the Apple credential to /api/v1/auth/apple and returns the unwrapped payload', async (): Promise<void> => {
    const dto: AppleAuthRequestDto = {
      identityToken: 'identity-token',
      authorizationCode: 'authorization-code',
      nonce: 'raw-nonce',
      givenName: 'Ana',
      familyName: 'Reyes',
    };
    const response: AppleAuthResponse = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 900,
      user: { id: 'user_1' } as User,
    };
    axiosInstance.defaults.adapter = envelopeAdapter(response);

    await expect(authAPI.appleLogin(dto)).resolves.toEqual(response);

    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe('post');
    expect(`${captured[0].baseURL ?? ''}${captured[0].url ?? ''}`).toMatch(/\/api\/v1\/auth\/apple$/);
    expect(JSON.parse(captured[0].data as string)).toEqual(dto);
  });
});
