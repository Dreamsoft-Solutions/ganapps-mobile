import { describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { createElement } from 'react';
import { ganapsAPI } from '@/api/endpoints/ganaps';
import type { CursorPage } from '@/api/types/api-response';
import type { GanapListItem } from '@/types/ganap.types';
import { useGanapsMap } from './useGanapsMap';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (): Promise<string | null> => null),
  setItemAsync: jest.fn(async (): Promise<void> => undefined),
  deleteItemAsync: jest.fn(async (): Promise<void> => undefined),
}));

jest.mock('@/api/endpoints/ganaps', () => ({
  ganapsAPI: { list: jest.fn() },
}));

const mockedList = jest.mocked(ganapsAPI.list);

/** Builds a Ganap list item carrying only the fields the hook reads. */
function ganapWithTags(id: string, tags: string[]): GanapListItem {
  return {
    id,
    businessId: 'business_1',
    businessName: 'Org',
    slug: id,
    title: id,
    description: '',
    address: null,
    locationLat: 14.5,
    locationLong: 120.9,
    startDate: new Date().toISOString(),
    endDate: null,
    tags,
    coverImage: null,
    mapPinImage: null,
    registrationCount: 0,
    likesCount: 0,
    createdAt: new Date().toISOString(),
    isLiked: false,
    isSaved: false,
  };
}

function pageWith(items: GanapListItem[]): CursorPage<GanapListItem> {
  return {
    items,
    pagination: { total: items.length, cursor: null, nextCursor: null, limit: 100 },
  };
}

function createWrapper(): (props: { children: ReactNode }) => ReactElement {
  const testClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }): ReactElement =>
    createElement(QueryClientProvider, { client: testClient }, children);
}

describe('useGanapsMap', () => {
  beforeEach(() => {
    mockedList.mockReset();
  });

  it('keeps the full tag set when a tag filter narrows the items', async () => {
    mockedList.mockResolvedValueOnce(pageWith([ganapWithTags('ganap_1', ['sports', 'tech'])]));

    const { result } = await renderHook(() => useGanapsMap(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.tags).toEqual(['sports', 'tech']));

    mockedList.mockResolvedValueOnce(pageWith([ganapWithTags('ganap_1', ['sports'])]));

    await act(async () => {
      result.current.setTag('sports');
    });

    await waitFor(() => expect(result.current.items.map((g) => g.id)).toEqual(['ganap_1']));
    await waitFor(() => expect(mockedList).toHaveBeenLastCalledWith({ tag: 'sports', limit: 100 }));
    expect(result.current.tags).toEqual(['sports', 'tech']);
  });
});
