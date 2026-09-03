import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import axiosInstance from '../axios-instance';
import { authAPI } from './auth';

/** Requests captured by the fake adapter during a test. */
let captured: AxiosRequestConfig[] = [];

/** Builds a standard server response envelope around an inner payload. */
function envelopeAdapter(payload: unknown, status = 202): (config: AxiosRequestConfig) => Promise<AxiosResponse> {
  return async (config: AxiosRequestConfig): Promise<AxiosResponse> => {
    captured.push(config);
    return {
      data: { success: true, statusCode: status, data: payload, message: 'Accepted' },
      status,
      statusText: 'Accepted',
      headers: {},
      config: config as AxiosResponse['config'],
    };
  };
}

/** Reads the JSON body captured by Axios after its default transform. */
function requestBody(config: AxiosRequestConfig): unknown {
  return typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
}

const deletedResponse = {
  status: 'DELETED' as const,
  deletedAt: '2026-09-03T00:00:00.000Z',
  firebaseIdentityDeletion: 'QUEUED' as const,
};

beforeEach((): void => {
  captured = [];
});

afterEach((): void => {
  axiosInstance.defaults.adapter = undefined;
});

describe('authAPI.deleteAccount', (): void => {
  it('sends the exact confirmation body and required idempotency header', async (): Promise<void> => {
    axiosInstance.defaults.adapter = envelopeAdapter(deletedResponse);

    const result = await authAPI.deleteAccount('DELETE MY ACCOUNT', 'delete-key-1');

    expect(captured[0]?.method).toBe('delete');
    expect(`${captured[0]?.baseURL ?? ''}${captured[0]?.url ?? ''}`).toContain('/api/v1/auth/me');
    expect(requestBody(captured[0])).toEqual({ confirmationPhrase: 'DELETE MY ACCOUNT' });
    expect(captured[0]?.headers).toMatchObject({ 'Idempotency-Key': 'delete-key-1' });
    expect(result).toEqual(deletedResponse);
  });

  it('returns the same typed terminal payload for an already-deleted replay', async (): Promise<void> => {
    const alreadyDeletedResponse = {
      status: 'ALREADY_DELETED' as const,
      deletedAt: deletedResponse.deletedAt,
      firebaseIdentityDeletion: 'NOT_LINKED' as const,
    };
    axiosInstance.defaults.adapter = envelopeAdapter(alreadyDeletedResponse);

    const result = await authAPI.deleteAccount('DELETE MY ACCOUNT', 'same-delete-key');

    expect(result.status).toBe('ALREADY_DELETED');
    expect(captured[0]?.headers).toMatchObject({ 'Idempotency-Key': 'same-delete-key' });
  });
});
