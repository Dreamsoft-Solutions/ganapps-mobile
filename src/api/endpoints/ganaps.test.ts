import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import type { GanapAnnouncement } from '@/types/ganap.types';
import axiosInstance from '../axios-instance';
import type { PaginatedResponse } from '../types/api-response';
import { ganapsAPI } from './ganaps';

/** Requests captured by the fake adapter during a test. */
let captured: AxiosRequestConfig[] = [];

/**
 * Builds an axios adapter that records the outgoing request and replies with
 * the server's standard response envelope wrapping `payload`.
 *
 * @param payload - The inner value the server would return inside `data`
 * @returns An axios adapter suitable for `axiosInstance.defaults.adapter`
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

/** The full URL an axios request resolves to. */
function requestedUrl(config: AxiosRequestConfig): string {
  return `${config.baseURL ?? ''}${config.url ?? ''}`;
}

const page = {
  items: [{ id: 'g1', title: 'Foundation Week', attendanceOpenMinutesBefore: 30 }],
  pagination: { total: 1, cursor: null, nextCursor: null, limit: 20 },
};

const blocks = [
  {
    id: 'block_text',
    ganapId: 'g1',
    scope: 'REGISTRATION',
    type: 'TEXT',
    label: 'Why do you want to attend?',
    isRequired: true,
    allowMultiple: false,
    order: 1,
    config: { placeholder: 'Tell us briefly', maxLength: 120 },
    options: [],
    createdAt: '2026-08-03T00:00:00.000Z',
    updatedAt: '2026-08-03T00:00:00.000Z',
  },
];

beforeEach(() => {
  captured = [];
});

afterEach(() => {
  axiosInstance.defaults.adapter = undefined;
});

describe('ganapsAPI.list', () => {
  it('targets the versioned ganaps path', async () => {
    axiosInstance.defaults.adapter = envelopeAdapter(page);

    await ganapsAPI.list();

    expect(requestedUrl(captured[0])).toContain('/api/v1/ganaps');
  });

  it('returns the page itself, not the response envelope', async () => {
    axiosInstance.defaults.adapter = envelopeAdapter(page);

    const result = await ganapsAPI.list();

    expect(result.items).toHaveLength(1);
    expect(result.items[0].attendanceOpenMinutesBefore).toBe(30);
    expect(result.pagination.limit).toBe(20);
  });

  it('forwards cursor and limit as query params', async () => {
    axiosInstance.defaults.adapter = envelopeAdapter(page);

    await ganapsAPI.list({ cursor: 'g1', limit: 5 });

    expect(captured[0].params).toEqual({ cursor: 'g1', limit: 5 });
  });

  it('forwards search and tag filters as query params', async () => {
    axiosInstance.defaults.adapter = envelopeAdapter(page);

    await ganapsAPI.list({ search: 'music', tag: 'concert' });

    expect(captured[0].params).toEqual({ search: 'music', tag: 'concert' });
  });
});

describe('ganapsAPI.getById', () => {
  it('targets the ganap detail path', async () => {
    axiosInstance.defaults.adapter = envelopeAdapter({ id: 'g1' });

    await ganapsAPI.getById('g1');

    expect(requestedUrl(captured[0])).toContain('/api/v1/ganaps/g1');
  });
});

describe('ganapsAPI.join', () => {
  it('posts to the join path and returns the registration', async () => {
    axiosInstance.defaults.adapter = envelopeAdapter({ id: 'r1', status: 'WAITLISTED' });

    const result = await ganapsAPI.join('g1');

    expect(captured[0].method).toBe('post');
    expect(requestedUrl(captured[0])).toContain('/api/v1/ganaps/g1/join');
    expect(result.status).toBe('WAITLISTED');
  });
});

describe('ganapsAPI.registration form', () => {
  it('lists registration form blocks with the required scope filter', async () => {
    axiosInstance.defaults.adapter = envelopeAdapter(blocks);

    await expect(ganapsAPI.listFormBlocks('g1', 'REGISTRATION')).resolves.toEqual(blocks);

    expect(captured[0].method).toBe('get');
    expect(requestedUrl(captured[0])).toContain('/api/v1/ganaps/g1/form-blocks');
    expect(captured[0].params).toEqual({ scope: 'REGISTRATION' });
  });

  it('submits form answers without wrapping the request body', async () => {
    const input = { answers: [{ formBlockId: 'block_text', textValue: 'To learn.' }] };
    axiosInstance.defaults.adapter = envelopeAdapter({ id: 'r1', status: 'REGISTERED' });

    await expect(ganapsAPI.submitFormAnswers('g1', input)).resolves.toMatchObject({ status: 'REGISTERED' });

    expect(captured[0].method).toBe('post');
    expect(requestedUrl(captured[0])).toContain('/api/v1/ganaps/g1/form-answers');
    expect(JSON.parse(String(captured[0].data))).toEqual(input);
  });
});

describe('ganapsAPI.listUserAnnouncements', () => {
  const announcementPage: PaginatedResponse<GanapAnnouncement> = {
    items: [
      {
        id: 'announcement_1',
        ganapId: 'g1',
        createdByUserId: 'user_1',
        createdByUsername: 'Miguel Santos',
        type: 'UPDATE',
        title: 'Venue update',
        content: 'Meet by the main entrance.',
        createdAt: '2026-08-04T01:00:00.000Z',
      },
    ],
    pagination: { total: 21, skip: 20, take: 20, pages: 2 },
  };

  it('targets the attendee announcements path with skip/take params', async () => {
    axiosInstance.defaults.adapter = envelopeAdapter(announcementPage);

    await ganapsAPI.listUserAnnouncements('g1', { skip: 20, take: 20 });

    expect(requestedUrl(captured[0])).toContain('/api/v1/ganaps/g1/announcements/user');
    expect(captured[0].params).toEqual({ skip: 20, take: 20 });
  });

  it('returns the paginated payload itself, not the response envelope', async () => {
    axiosInstance.defaults.adapter = envelopeAdapter(announcementPage);

    const result = await ganapsAPI.listUserAnnouncements('g1', { skip: 20, take: 20 });

    expect(result).toEqual(announcementPage);
  });
});

describe('ganapsAPI toggles', () => {
  it('likes with POST and unlikes with DELETE on the same path', async () => {
    axiosInstance.defaults.adapter = envelopeAdapter(null);

    await ganapsAPI.like('g1');
    await ganapsAPI.unlike('g1');

    expect(captured[0].method).toBe('post');
    expect(captured[1].method).toBe('delete');
    expect(requestedUrl(captured[0])).toContain('/api/v1/ganaps/g1/like');
    expect(requestedUrl(captured[1])).toContain('/api/v1/ganaps/g1/like');
  });
});

describe('ganapsAPI.rateGanap', () => {
  it('posts a rating to the versioned rate path', async () => {
    const rating = {
      id: 'rating_1',
      ganapId: 'g1',
      userId: 'u1',
      rating: 4,
      comment: null,
      createdAt: '2026-08-18T00:00:00.000Z',
      updatedAt: '2026-08-18T00:00:00.000Z',
    };
    axiosInstance.defaults.adapter = envelopeAdapter(rating);

    await expect(ganapsAPI.rateGanap('g1', { score: 4 })).resolves.toEqual(rating);
    expect(requestedUrl(captured[0])).toContain('/api/v1/ganaps/g1/rate');
    expect(captured[0].data).toBe(JSON.stringify({ score: 4 }));
  });

  it('threads the form-block scope through the answer submission body', async () => {
    axiosInstance.defaults.adapter = envelopeAdapter({ id: 'reg_1', status: 'ATTENDED' });

    await ganapsAPI.submitFormAnswers('g1', {
      scope: 'POST_ATTENDANCE',
      answers: [{ formBlockId: 'block_1', textValue: 'Great event' }],
    });

    expect(JSON.parse(String(captured[0].data)).scope).toBe('POST_ATTENDANCE');
  });
});

describe('checkIn', () => {
  it('POSTs the qr hash and scan time to the version-free check-in path', async () => {
    const payload = {
      id: 'reg-1',
      userId: 'u-1',
      ganapId: 'g-1',
      status: 'ATTENDED',
      createdAt: '2026-08-01T00:00:00.000Z',
    };
    axiosInstance.defaults.adapter = envelopeAdapter(payload);

    const result = await ganapsAPI.checkIn('g-1', {
      qrHash: 'hash-abc',
      scannedAt: '2026-08-08T13:00:00.000Z',
    });

    expect(captured[0].method).toBe('post');
    expect(requestedUrl(captured[0])).toContain('/api/v1/ganaps/g-1/check-in');
    expect(JSON.parse(String(captured[0].data))).toEqual({
      qrHash: 'hash-abc',
      scannedAt: '2026-08-08T13:00:00.000Z',
    });
    expect(result).toEqual(payload);
  });
});
