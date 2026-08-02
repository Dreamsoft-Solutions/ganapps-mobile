import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { useAuthStore } from '@/store/auth.store';
import axiosInstance from './axios-instance';
import { authAPI } from './endpoints/auth';
import { refreshAccessToken } from './interceptors/refresh-token';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    setItemAsync: async (key: string, value: string) => {
      store.set(key, value);
    },
    getItemAsync: async (key: string) => store.get(key) ?? null,
    deleteItemAsync: async (key: string) => {
      store.delete(key);
    },
  };
});

/** Requests captured by the fake adapter during a test. */
let captured: AxiosRequestConfig[] = [];

/**
 * Builds an axios adapter that records the outgoing request and replies with
 * the server's standard response envelope wrapping `payload`.
 */
function envelopeAdapter(payload: unknown) {
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

/** The full URL an axios request resolves to. */
function requestedUrl(config: AxiosRequestConfig): string {
  return `${config.baseURL ?? ''}${config.url ?? ''}`;
}

const tokens = { accessToken: 'new-access', refreshToken: 'new-refresh', expiresIn: 900 };

beforeEach(() => {
  captured = [];
});

afterEach(() => {
  axios.defaults.adapter = undefined;
  axiosInstance.defaults.adapter = undefined;
});

describe('refreshAccessToken', () => {
  it('returns the token payload rather than the response envelope', async () => {
    axios.defaults.adapter = envelopeAdapter(tokens);

    const result = await refreshAccessToken('stored-refresh');

    expect(result.accessToken).toBe('new-access');
    expect(result.refreshToken).toBe('new-refresh');
    expect(result.expiresIn).toBe(900);
  });

  it('stores the real access token in the auth store', async () => {
    axios.defaults.adapter = envelopeAdapter(tokens);

    await refreshAccessToken('stored-refresh');

    expect(useAuthStore.getState().token).toBe('new-access');
  });

  it('targets the versioned refresh path', async () => {
    axios.defaults.adapter = envelopeAdapter(tokens);

    await refreshAccessToken('stored-refresh');

    expect(requestedUrl(captured[0])).toContain('/api/v1/auth/refresh');
  });
});

describe('401 refresh-and-retry', () => {
  it('unwraps the envelope of the retried request', async () => {
    await useAuthStore.getState().setAuth('expired-access', 'stored-refresh', 900);
    let meCalls = 0;

    const router = async (config: AxiosRequestConfig): Promise<AxiosResponse> => {
      captured.push(config);
      const url = requestedUrl(config);
      const reply = (payload: unknown, status: number): AxiosResponse => ({
        data: { success: true, statusCode: status, data: payload, message: 'Success' },
        status,
        statusText: 'OK',
        headers: {},
        config: config as AxiosResponse['config'],
      });

      if (url.includes('/auth/refresh')) return reply(tokens, 200);

      meCalls += 1;
      if (meCalls === 1) {
        const error = new axios.AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config as AxiosResponse['config']);
        error.response = reply(null, 401);
        error.response.status = 401;
        throw error;
      }
      return reply({ id: 'user-1', email: 'a@b.com' }, 200);
    };

    axios.defaults.adapter = router;
    axiosInstance.defaults.adapter = router;

    const user = await authAPI.getMe();

    expect(user).toEqual({ id: 'user-1', email: 'a@b.com' });
  });
});

describe('authAPI', () => {
  it('targets the versioned login path', async () => {
    axiosInstance.defaults.adapter = envelopeAdapter(tokens);

    await authAPI.login({ email: 'a@b.com', password: 'pw' });

    expect(requestedUrl(captured[0])).toContain('/api/v1/auth/login');
  });

  it('unwraps the response envelope for callers', async () => {
    axiosInstance.defaults.adapter = envelopeAdapter(tokens);

    const result = await authAPI.login({ email: 'a@b.com', password: 'pw' });

    expect(result.accessToken).toBe('new-access');
  });

  it('patches the current profile through the versioned auth path', async () => {
    const user = { id: 'user-1', bio: 'Finding good events.' };
    axiosInstance.defaults.adapter = envelopeAdapter(user);

    const result = await authAPI.updateProfile({ bio: user.bio });

    expect(captured[0].method).toBe('patch');
    expect(requestedUrl(captured[0])).toContain('/api/v1/auth/me');
    expect(result).toEqual(user);
  });

  it('preserves multipart profile uploads instead of serializing them as JSON', async () => {
    const formData = new FormData();
    formData.append('file', 'avatar');
    axiosInstance.defaults.adapter = envelopeAdapter({ id: 'user-1' });

    await authAPI.updateProfile(formData);

    expect(captured[0].data).toBe(formData);
    expect(captured[0].headers?.['Content-Type']).not.toBe('application/json');
  });

  it('preserves React Native FormData identified by getParts', async () => {
    const nativeFormData = {
      getParts: (): never[] => [],
    } as unknown as FormData;
    axiosInstance.defaults.adapter = envelopeAdapter({ id: 'user-1' });

    await authAPI.updateProfile(nativeFormData);

    expect(captured[0].data).toEqual(expect.objectContaining({ getParts: expect.any(Function) }));
  });
});
