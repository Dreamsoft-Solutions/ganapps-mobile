import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import axiosInstance from '../axios-instance';
import { profileAPI } from './profile';

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

/**
 * Returns the complete URL captured by the fake adapter.
 *
 * @param config - Captured Axios request.
 * @returns Resolved request URL.
 */
function requestedUrl(config: AxiosRequestConfig): string {
  return `${config.baseURL ?? ''}${config.url ?? ''}`;
}

beforeEach(() => {
  captured = [];
});

afterEach(() => {
  axiosInstance.defaults.adapter = undefined;
});

describe('profileAPI.listJoinedGanaps', () => {
  it('targets the versioned joined Ganap profile path', async () => {
    axiosInstance.defaults.adapter = envelopeAdapter({
      items: [],
      pagination: { total: 0, skip: 0, take: 20, pages: 0 },
    });

    await profileAPI.listJoinedGanaps({ skip: 20, take: 10 });

    expect(requestedUrl(captured[0])).toContain('/api/v1/profile/me/joined-ganaps');
    expect(captured[0].params).toEqual({ skip: 20, take: 10 });
  });

  it('returns the unwrapped paginated payload', async () => {
    const page = {
      items: [{ id: 'ganap_1', title: 'Campus Day' }],
      pagination: { total: 1, skip: 0, take: 20, pages: 1 },
    };
    axiosInstance.defaults.adapter = envelopeAdapter(page);

    await expect(profileAPI.listJoinedGanaps()).resolves.toEqual(page);
  });

  it('sends optional search and time to the joined-event endpoint', async () => {
    axiosInstance.defaults.adapter = envelopeAdapter({
      items: [],
      pagination: { total: 0, skip: 0, take: 20, pages: 0 },
    });

    await profileAPI.listJoinedGanaps({
      skip: 0,
      take: 20,
      search: 'design',
      time: 'PAST',
    });

    expect(captured[0].params).toEqual({ skip: 0, take: 20, search: 'design', time: 'PAST' });
  });
});
