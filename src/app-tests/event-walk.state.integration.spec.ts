/** @vitest-environment happy-dom */

import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axiosInstance } from '@/api/axios-instance';
import { ganapQueryKeys } from '@/hooks/queries/useGanapsQuery';
import { type UseEventWalkResult, useEventWalk, type WalkLocation } from '@/hooks/useEventWalk';
import { useAuthStore } from '@/store/auth.store';
import type { GanapDetail } from '@/types/ganap.types';
import type { User } from '@/types/user.types';
import type { WalkCard, WalkInteractionInput, WalkPage } from '@/types/walk.types';

vi.mock('expo-secure-store', () => ({}));
vi.mock('react-native', () => ({ AppState: { addEventListener: () => ({ remove: vi.fn() }) } }));
vi.mock('@/db', () => ({
  db: { select: () => ({ from: () => ({ where: () => ({ limit: async (): Promise<unknown[]> => [] }) }) }) },
}));

const WALK_TOKEN = 'signed-walk-token';
const LOCATION: WalkLocation = { status: 'ready', coords: { latitude: 10.72, longitude: 122.56 } };

interface FakeServer {
  pages: Record<string, WalkPage>;
  walkStatus: number;
  interactionStatus: number;
  likeStatus: number;
  walkRequests: Array<Record<string, unknown>>;
  interactions: WalkInteractionInput[];
  likes: string[];
  onLike: (() => void) | null;
}

const server: FakeServer = {
  pages: {},
  walkStatus: 200,
  interactionStatus: 204,
  likeStatus: 201,
  walkRequests: [],
  interactions: [],
  likes: [],
  onLike: null,
};
const probe: { result: UseEventWalkResult | null } = { result: null };

/** Builds a walk card for an upcoming event the User has not engaged with. */
function walkCard(id: string): WalkCard {
  return {
    id,
    businessId: 'business-1',
    businessName: 'Iloilo Organizers',
    slug: id,
    title: `Event ${id}`,
    description: 'An evening by the river.',
    address: 'Iloilo City',
    locationLat: 10.7,
    locationLong: 122.56,
    startDate: '2026-12-01T10:00:00.000Z',
    endDate: null,
    attendanceOpenMinutesBefore: 30,
    mainTag: 'Food & Drink',
    subTags: [],
    tags: ['Food & Drink'],
    coverImage: null,
    mapPinImage: null,
    registrationCount: 2,
    likesCount: 1,
    createdAt: '2026-11-01T10:00:00.000Z',
    distanceKm: 2.4,
    isLiked: false,
    isSaved: false,
  };
}

function walkPage(ids: string[], nextCursor: string | null): WalkPage {
  return {
    asOf: '2026-11-24T10:00:00.000Z',
    walkToken: WALK_TOKEN,
    items: ids.map(walkCard),
    pagination: { total: 3, cursor: null, nextCursor, limit: 2 },
  };
}

function respond(config: InternalAxiosRequestConfig, status: number, data: unknown): AxiosResponse {
  return {
    config,
    data: status === 204 ? '' : { success: true, statusCode: status, data, message: 'OK' },
    status,
    statusText: 'OK',
    headers: {},
  };
}

function reject(config: InternalAxiosRequestConfig, status: number): AxiosError {
  return new AxiosError(
    `Request failed with status code ${String(status)}`,
    AxiosError.ERR_BAD_RESPONSE,
    config,
    null,
    {
      config,
      data: { success: false, statusCode: status, message: 'Rejected' },
      status,
      statusText: 'Error',
      headers: {},
    },
  );
}

async function walkServer(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
  const request = `${config.method} ${config.url}`;
  if (request === 'get /walk') {
    const params = (config.params ?? {}) as Record<string, unknown>;
    server.walkRequests.push(params);
    if (server.walkStatus !== 200) throw reject(config, server.walkStatus);
    const cursor = typeof params.cursor === 'string' ? params.cursor : 'first';
    return respond(config, 200, server.pages[cursor]);
  }
  if (request === 'post /walk/interactions') {
    const input = JSON.parse(String(config.data)) as WalkInteractionInput;
    server.interactions.push(input);
    if (server.interactionStatus !== 204) throw reject(config, server.interactionStatus);
    return respond(config, 204, null);
  }
  if (request.startsWith('post /ganaps/') && (request.endsWith('/like') || request.endsWith('/save'))) {
    server.likes.push(String(config.url));
    server.onLike?.();
    if (server.likeStatus >= 400) throw reject(config, server.likeStatus);
    return respond(config, server.likeStatus, null);
  }
  throw new Error(`Unexpected request: ${request}`);
}

function WalkProbe({ location }: { location: WalkLocation }): null {
  probe.result = useEventWalk(location);
  return null;
}

function walk(): UseEventWalkResult {
  if (probe.result === null) throw new Error('The walk is not mounted');
  return probe.result;
}

function currentCard(): WalkCard {
  const { screen } = walk();
  if (screen.kind !== 'card') throw new Error(`Expected a card, got ${screen.kind}`);
  return screen.card;
}

const client = new QueryClient({
  defaultOptions: { queries: { gcTime: Infinity }, mutations: { networkMode: 'always' } },
});
const originalAdapter: typeof axiosInstance.defaults.adapter = axiosInstance.defaults.adapter;
let root: Root | null = null;

beforeEach((): void => {
  useAuthStore.setState({ token: 'integration-token', user: { id: 'user-1' } as User });
  axiosInstance.defaults.adapter = (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => walkServer(config);
  server.pages = { first: walkPage(['c1', 'c2'], 'cursor-2'), 'cursor-2': walkPage(['c3'], null) };
});

afterEach((): void => {
  root?.unmount();
  root = null;
  client.clear();
  axiosInstance.defaults.adapter = originalAdapter;
  useAuthStore.setState({ token: null, user: null });
  server.pages = {};
  server.walkStatus = 200;
  server.interactionStatus = 204;
  server.likeStatus = 201;
  server.walkRequests = [];
  server.interactions = [];
  server.likes = [];
  server.onLike = null;
  probe.result = null;
  onlineManager.setOnline(true);
});

async function startWalk(): Promise<void> {
  const container: HTMLDivElement = document.createElement('div');
  root = createRoot(container);
  root.render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(WalkProbe as (props: { location: WalkLocation }) => ReactElement | null, { location: LOCATION }),
    ),
  );
  await vi.waitFor((): void => expect(['card', 'closed', 'end', 'error']).toContain(walk().screen.kind));
}

async function pass(expectedNextId: string | null): Promise<void> {
  walk().next();
  await vi.waitFor((): void => {
    const { screen } = walk();
    if (expectedNextId === null) expect(screen.kind).toBe('end');
    else expect(screen.kind === 'card' && screen.card.id).toBe(expectedNextId);
  });
}

describe('Event Walk', (): void => {
  it('asks for the first page with the position, and shows the top card', async (): Promise<void> => {
    await startWalk();

    expect(currentCard().id).toBe('c1');
    expect(server.walkRequests[0]).toMatchObject({ lat: 10.72, long: 122.56 });
    expect(server.walkRequests[0]?.seed).toBeUndefined();
  });

  describe('like on the walk card', (): void => {
    it('updates the card and keeps it after the server accepts', async (): Promise<void> => {
      await startWalk();

      walk().toggleLike();

      await vi.waitFor((): void => expect(currentCard()).toMatchObject({ id: 'c1', isLiked: true, likesCount: 2 }));
      await vi.waitFor((): void => expect(server.likes).toEqual(['/ganaps/c1/like']));
      expect(currentCard().isLiked).toBe(true);
      expect(server.walkRequests.filter((request) => request.cursor === undefined)).toHaveLength(1);
    });

    it('puts the card back when the server rejects the like', async (): Promise<void> => {
      server.likeStatus = 500;
      const likeRefused = Promise.withResolvers<void>();
      server.onLike = (): void => likeRefused.resolve();
      await startWalk();

      walk().toggleLike();

      await likeRefused.promise;
      await vi.waitFor((): void => expect(currentCard()).toMatchObject({ id: 'c1', isLiked: false, likesCount: 1 }));
    });
  });

  describe('Next', (): void => {
    it('sends SKIPPED for the card with the walk token, and shows the next card', async (): Promise<void> => {
      await startWalk();

      await pass('c2');

      await vi.waitFor((): void =>
        expect(server.interactions).toEqual([{ ganapId: 'c1', type: 'SKIPPED', walkToken: WALK_TOKEN }]),
      );
    });

    it('sends nothing for a card the User liked', async (): Promise<void> => {
      await startWalk();
      walk().toggleLike();
      await vi.waitFor((): void => expect(currentCard().isLiked).toBe(true));

      await pass('c2');
      await pass('c3');

      await vi.waitFor((): void =>
        expect(server.interactions).toEqual([{ ganapId: 'c2', type: 'SKIPPED', walkToken: WALK_TOKEN }]),
      );
    });

    it('sends OPENED once when the User opens a card, and no SKIPPED after', async (): Promise<void> => {
      await startWalk();

      walk().open();
      await vi.waitFor((): void =>
        expect(server.interactions).toEqual([{ ganapId: 'c1', type: 'OPENED', walkToken: WALK_TOKEN }]),
      );
      walk().open();
      expect(currentCard().id).toBe('c1');

      await pass('c2');
      expect(server.interactions).toHaveLength(1);
    });

    it('fetches the next page by cursor and keeps each card once', async (): Promise<void> => {
      server.pages['cursor-2'] = walkPage(['c2', 'c3'], null);
      await startWalk();

      await pass('c2');
      await pass('c3');

      expect(server.walkRequests.map((request) => request.cursor)).toEqual([undefined, 'cursor-2']);
    });
  });

  describe('the end of the walk', (): void => {
    it('offers More like this seeded with the events liked, saved or registered for', async (): Promise<void> => {
      await startWalk();
      walk().toggleLike();
      await vi.waitFor((): void => expect(currentCard().isLiked).toBe(true));
      await pass('c2');
      const detail = { id: 'c2', myRegistration: { id: 'r1', status: 'REGISTERED' } } as GanapDetail;
      client.setQueryData(ganapQueryKeys.detail('c2'), detail);
      await pass('c3');
      walk().toggleSave();
      await vi.waitFor((): void => expect(currentCard().isSaved).toBe(true));
      await pass(null);

      const { screen } = walk();
      expect(screen).toEqual({ kind: 'end', viewed: 3, seedIds: ['c1', 'c2', 'c3'] });

      server.pages = { first: walkPage(['c9'], null) };
      walk().startMoreLikeThis();

      await vi.waitFor((): void => expect(currentCard().id).toBe('c9'));
      expect(server.walkRequests.at(-1)).toMatchObject({ seed: 'c1,c2,c3', lat: 10.72, long: 122.56 });
    });

    it('offers only a new walk when nothing was liked, saved or registered for', async (): Promise<void> => {
      await startWalk();
      await pass('c2');
      await pass('c3');
      await pass(null);

      expect(walk().screen).toEqual({ kind: 'end', viewed: 3, seedIds: [] });

      server.pages = { first: walkPage(['c1'], null) };
      walk().startNewWalk();

      await vi.waitFor((): void => expect(currentCard().id).toBe('c1'));
      expect(server.walkRequests.at(-1)?.seed).toBeUndefined();
    });
  });

  describe('a 403', (): void => {
    it('closes the walk when the walk request is refused, without retrying', async (): Promise<void> => {
      server.walkStatus = 403;

      await startWalk();

      expect(walk().screen.kind).toBe('closed');
      expect(server.walkRequests).toHaveLength(1);
    });

    it('closes the walk when an interaction is refused', async (): Promise<void> => {
      server.interactionStatus = 403;
      await startWalk();

      walk().next();

      await vi.waitFor((): void => expect(walk().screen.kind).toBe('closed'));
      expect(server.interactions).toHaveLength(1);
    });
  });
});
