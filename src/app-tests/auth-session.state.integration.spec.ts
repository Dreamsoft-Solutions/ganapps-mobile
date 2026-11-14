/** @vitest-environment happy-dom */

import type { SQLInputValue } from 'node:sqlite';
import { DatabaseSync } from 'node:sqlite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { createElement, Fragment, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { axiosInstance } from '@/api/axios-instance';
import AppLayout from '@/app/(app)/_layout';
import { useUpdateProfileMutation } from '@/hooks/mutations/useAuthMutation';
import { authQueryKeys } from '@/hooks/queries/useAuthQuery';
import { enqueueOutbox, syncOutbox } from '@/services/sync.service';
import { useAuthStore } from '@/store/auth.store';
import type { User } from '@/types/user.types';

const runtime = vi.hoisted(() => ({
  db: undefined as unknown,
  segments: ['(app)'],
  router: { replace: vi.fn() },
}));

vi.mock('@/db', () => ({
  get db(): unknown {
    return runtime.db;
  },
}));
vi.mock('react-native', () => ({ AppState: { addEventListener: () => ({ remove: vi.fn() }) } }));
vi.mock('expo-router', () => ({
  Tabs: Object.assign(() => null, { Screen: () => null }),
  useRouter: () => runtime.router,
  useSegments: () => runtime.segments,
  useRootNavigationState: () => ({ key: 'root' }),
}));
vi.mock('@/components/common/Loading', () => ({ Loading: () => 'Loading' }));
vi.mock('@/components/navigation/AppTabBar', () => ({ AppTabBar: () => null, BAR_HEIGHT: 0 }));
vi.mock('@/hooks/queries/useChatQuery', () => ({
  chatQueryKeys: { summaries: () => ['chat', 'summaries'] },
  useChatSummariesQuery: () => ({ hasUnreadMessages: false }),
}));
vi.mock('@/services/chat-socket.service', () => ({
  chatSocketClient: {
    onSummaryChange: () => () => {},
    onConnectionStateChange: () => () => {},
  },
}));
vi.mock('@/services/friend-presence.service', () => ({ startFriendPresenceHeartbeat: () => () => {} }));
vi.mock('@/services/push-notification.service', () => ({
  getPendingNotificationTarget: () => null,
  revokeRegisteredPushTokens: vi.fn(),
  subscribeToPendingNotification: () => () => {},
  startPushTokenSync: () => () => {},
}));
vi.mock('@/utils/secure-storage', () => ({
  secureStorage: {
    setTokens: vi.fn().mockResolvedValue(undefined),
    getRefreshToken: vi.fn().mockResolvedValue(null),
    clearTokens: vi.fn().mockResolvedValue(undefined),
  },
}));

function profile(id: string): User {
  return {
    id,
    email: `${id}@example.com`,
    username: id,
    firstName: 'Test',
    lastName: 'User',
    interests: [],
    isVerified: true,
    createdAt: '2026-11-01T00:00:00.000Z',
  };
}

function AuthenticatedShell(): ReactElement {
  const { mutate } = useUpdateProfileMutation();
  return createElement(
    Fragment,
    null,
    createElement(AppLayout),
    createElement('button', { type: 'button', onClick: () => mutate({ bio: 'Updated by A' }) }, 'Edit profile'),
  );
}

it('holds an offline action for its owner across forced sign-out and a delayed profile for the next User', async () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`CREATE TABLE outbox (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    action TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    retries INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);
  runtime.db = drizzle(async (sql, params, method) => {
    const statement = sqlite.prepare(sql);
    const bindings = params as SQLInputValue[];
    if (method === 'run') {
      statement.run(...bindings);
      return { rows: [] };
    }
    return { rows: statement.all(...bindings).map((row) => Object.values(row)) };
  });
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });
  const originalAdapter = axiosInstance.defaults.adapter;
  const container = document.createElement('div');
  const root = createRoot(container);
  const showApp = (): void =>
    root.render(createElement(QueryClientProvider, { client }, createElement(AuthenticatedShell)));
  const editA = Promise.withResolvers<User>();
  const profileB = Promise.withResolvers<User>();
  const requests: string[] = [];
  axiosInstance.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    const request = `${config.method} ${config.url}`;
    const authorization = config.headers.Authorization;
    requests.push(`${request}: ${authorization}`);
    const response = { config, headers: {}, data: undefined as unknown, status: 200, statusText: 'OK' };
    switch (request) {
      case 'get /auth/me':
        response.data = authorization === 'Bearer access-b' ? await profileB.promise : profile('user-a');
        return response;
      case 'patch /auth/me':
        response.data = await editA.promise;
        return response;
      case 'get /expired-session':
        throw new AxiosError('Expired session', 'ERR_BAD_REQUEST', config, undefined, {
          ...response,
          status: 401,
          statusText: 'Unauthorized',
        });
      case 'post /ganaps/ganap-a/like':
        return response;
      default:
        throw new Error(`Unexpected request: ${request}`);
    }
  };

  try {
    useAuthStore.setState({ isHydrated: true });
    await useAuthStore.getState().setAuth('access-a', 'refresh-a', 3600);
    showApp();
    await vi.waitFor(() => expect(useAuthStore.getState().user?.id).toBe('user-a'));
    await enqueueOutbox({ action: 'like', ganapId: 'ganap-a', ownerId: 'user-a' });
    container.querySelector('button')?.click();
    await vi.waitFor(() => expect(requests).toContain('patch /auth/me: Bearer access-a'));

    await expect(axiosInstance.get('/expired-session')).rejects.toMatchObject({ status: 401 });
    expect(useAuthStore.getState().token).toBeNull();
    root.render(null);
    await vi.waitFor(() => expect(client.getQueryCache().findAll({ type: 'active' })).toHaveLength(0));

    await useAuthStore.getState().setAuth('access-b', 'refresh-b', 3600);
    void client.invalidateQueries({ queryKey: authQueryKeys.all });
    showApp();
    await vi.waitFor(() => expect(requests).toContain('get /auth/me: Bearer access-b'));
    await syncOutbox();
    expect(requests.filter((request) => request.startsWith('post /ganaps/'))).toEqual([]);
    expect(sqlite.prepare('SELECT status FROM outbox').get()).toMatchObject({ status: 'pending' });

    editA.resolve({ ...profile('user-a'), bio: 'Updated by A' });
    await vi.waitFor(() => expect(client.getMutationCache().getAll()[0]?.state.status).toBe('error'));
    expect(useAuthStore.getState().user).toBeNull();

    profileB.resolve(profile('user-b'));
    await vi.waitFor(() => expect(useAuthStore.getState().user?.id).toBe('user-b'));
    await syncOutbox();
    expect(sqlite.prepare('SELECT status FROM outbox').get()).toMatchObject({ status: 'pending' });

    await useAuthStore.getState().clearAuth();
    await useAuthStore.getState().setAuth('access-a', 'refresh-a', 3600);
    await vi.waitFor(() => expect(useAuthStore.getState().user?.id).toBe('user-a'));
    await syncOutbox();
    expect(requests.filter((request) => request.startsWith('post /ganaps/'))).toEqual([
      'post /ganaps/ganap-a/like: Bearer access-a',
    ]);
    expect(sqlite.prepare('SELECT status FROM outbox').get()).toMatchObject({ status: 'success' });
  } finally {
    editA.resolve(profile('user-a'));
    profileB.resolve(profile('user-b'));
    root.unmount();
    client.clear();
    axiosInstance.defaults.adapter = originalAdapter;
    await useAuthStore.getState().clearAuth();
    sqlite.close();
  }
});
