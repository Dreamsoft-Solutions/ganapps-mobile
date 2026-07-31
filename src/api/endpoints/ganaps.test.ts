import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { axiosInstance } from '../axios-instance';
import { ganapsAPI } from './ganaps';

/**
 * Builds an axios adapter that replies with the server's standard response
 * envelope wrapping `payload`.
 */
function envelopeAdapter(payload: unknown) {
  return async (config: AxiosRequestConfig): Promise<AxiosResponse> => ({
    data: { success: true, statusCode: 200, data: payload, message: 'Success' },
    status: 200,
    statusText: 'OK',
    headers: {},
    config: config as AxiosResponse['config'],
  });
}

const sampleGanapList = {
  items: [
    {
      id: 'ganap_1',
      businessId: 'business_1',
      businessName: 'CPU Org',
      slug: 'cpu-org-event',
      title: 'Campus Event',
      description: 'A fun campus event.',
      address: 'CPU Campus',
      locationLat: 10.7313,
      locationLong: 122.5489,
      startDate: '2026-08-01T10:00:00.000Z',
      endDate: null,
      tags: ['campus'],
      coverImage: null,
      mapPinImage: null,
      registrationCount: 0,
      createdAt: '2026-07-01T00:00:00.000Z',
    },
  ],
  pagination: {
    total: 1,
    cursor: null,
    nextCursor: null,
    limit: 100,
  },
};

describe('ganapsAPI', () => {
  beforeEach(() => {
    axiosInstance.defaults.adapter = envelopeAdapter(sampleGanapList);
  });

  it('lists public Ganaps via GET /ganaps', async () => {
    const result = await ganapsAPI.listPublic({ search: 'campus', tag: 'campus', limit: 100 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.title).toBe('Campus Event');
    expect(result.pagination.total).toBe(1);
  });

  it('builds the correct request URL with query params', async () => {
    const spy = jest.spyOn(axiosInstance, 'get');
    await ganapsAPI.listPublic({ search: 'music', tag: 'concert' });

    expect(spy).toHaveBeenCalledWith('/ganaps', { params: { search: 'music', tag: 'concert' } });
    spy.mockRestore();
  });
});
