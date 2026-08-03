import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import type { BusinessDetail } from '@/types/business.types';
import axiosInstance from '../axios-instance';
import { businessesAPI } from './businesses';

let captured: AxiosRequestConfig[] = [];

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

function requestedUrl(config: AxiosRequestConfig): string {
  return String(config.baseURL ?? '') + String(config.url ?? '');
}

const business: BusinessDetail = {
  id: 'business_1',
  name: 'CPU Developers',
  slug: 'cpu-developers',
  bio: 'A student developer community.',
  displayPicture: 'https://example.com/business.jpg',
  verificationStatus: 'ACTIVE',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

beforeEach((): void => {
  captured = [];
});

afterEach((): void => {
  axiosInstance.defaults.adapter = undefined;
});

describe('businessesAPI.getById', (): void => {
  it('targets the versioned Business detail path and unwraps the payload', async (): Promise<void> => {
    axiosInstance.defaults.adapter = envelopeAdapter(business);

    const result = await businessesAPI.getById('business_1');

    expect(captured[0].method).toBe('get');
    expect(requestedUrl(captured[0])).toContain('/api/v1/businesses/business_1');
    expect(result).toEqual(business);
  });
});
