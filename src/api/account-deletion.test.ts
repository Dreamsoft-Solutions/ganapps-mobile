import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/auth.store';
import type { DeleteAccountResponse } from '@/types/auth.types';
import { deleteAccountSchema } from '@/utils/validation';
import axiosInstance from './axios-instance';
import { authAPI } from './endpoints/auth';

jest.mock('expo-secure-store', () => ({
  getItemAsync: async (): Promise<null> => null,
  setItemAsync: async (): Promise<void> => undefined,
  deleteItemAsync: async (): Promise<void> => undefined,
}));

beforeEach((): void => {
  useAuthStore.setState({ token: 'access-token', expiresAt: Date.now() + 900_000 });
});

afterEach((): void => {
  axiosInstance.defaults.adapter = undefined;
  useAuthStore.setState({ token: null, expiresAt: null });
});

describe('account deletion contract', (): void => {
  const deletionErrorCases: Array<[number, string]> = [
    [400, 'ACCOUNT_DELETION_CONFIRMATION_REQUIRED'],
    [400, 'IDEMPOTENCY_KEY_REQUIRED'],
    [409, 'IDEMPOTENCY_KEY_REUSED'],
    [401, 'UNAUTHORIZED'],
    [403, 'SUPERADMIN_ACCOUNT_CANNOT_BE_DELETED'],
    [500, 'ACCOUNT_DELETION_FAILED'],
  ];

  it.each([
    'DELETED',
    'ALREADY_DELETED',
  ] as const)('sends the exact body and replay key and unwraps %s', async (status: DeleteAccountResponse['status']): Promise<void> => {
    const payload: DeleteAccountResponse = {
      status,
      deletedAt: '2026-09-12T00:00:00.000Z',
      firebaseIdentityDeletion: 'QUEUED',
    };
    axiosInstance.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      expect(config.method).toBe('delete');
      expect(`${config.baseURL}${config.url}`).toContain('/api/v1/auth/me');
      expect(JSON.parse(config.data as string)).toEqual({ confirmationPhrase: 'DELETE MY ACCOUNT' });
      expect(config.headers.get('Idempotency-Key')).toBe('same-attempt');
      return {
        config,
        status: 202,
        statusText: 'Accepted',
        headers: {},
        data: { success: true, statusCode: 202, data: payload },
      };
    };
    await expect(authAPI.deleteAccount('DELETE MY ACCOUNT', 'same-attempt')).resolves.toEqual(payload);
  });

  it.each(
    deletionErrorCases,
  )('preserves %s / %s without retry or logout', async (status: number, errorCode: string): Promise<void> => {
    const adapter = jest.fn(async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      throw new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, undefined, {
        config,
        status,
        statusText: 'Rejected',
        headers: {},
        data: { success: false, statusCode: status, errorCode, message: 'Typed server message' },
      });
    });
    axiosInstance.defaults.adapter = adapter;
    await expect(authAPI.deleteAccount('DELETE MY ACCOUNT', 'same-attempt')).rejects.toMatchObject({
      status,
      errorCode,
      message: 'Typed server message',
    });
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().token).toBe('access-token');
  });

  it('keeps a transport failure distinguishable from a server response', async (): Promise<void> => {
    axiosInstance.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      throw new AxiosError('Network Error', 'ERR_NETWORK', config);
    };
    await expect(authAPI.deleteAccount('DELETE MY ACCOUNT', 'same-attempt')).rejects.toMatchObject({
      errorCode: 'NETWORK_ERROR',
      status: undefined,
    });
  });

  it('only accepts the exact phrase after trimming', (): void => {
    expect(deleteAccountSchema.parse({ confirmationPhrase: ' DELETE MY ACCOUNT ' })).toEqual({
      confirmationPhrase: 'DELETE MY ACCOUNT',
    });
    for (const confirmationPhrase of ['', 'delete my account', 'DELETE  MY ACCOUNT', 'DELETE MY ACCOUNT.']) {
      expect(deleteAccountSchema.safeParse({ confirmationPhrase }).success).toBe(false);
    }
  });
});
