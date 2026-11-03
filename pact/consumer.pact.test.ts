import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { MatchersV3, Pact } from '@pact-foundation/pact';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { authAPI } from '../src/api/endpoints/auth';
import type { chatAPI } from '../src/api/endpoints/chat';
import type { friendsAPI } from '../src/api/endpoints/friends';
import type { ganapsAPI } from '../src/api/endpoints/ganaps';
import type { refreshAccessToken } from '../src/api/interceptors/refresh-token';
import type { useAuthStore } from '../src/store/auth.store';
import { isValidFriendCode } from '../src/utils/friends';

const storage = vi.hoisted(() => new Map<string, string>());
vi.mock('expo-secure-store', () => ({
  setItemAsync: async (key: string, value: string) => {
    storage.set(key, value);
  },
  getItemAsync: async (key: string) => storage.get(key) ?? null,
  deleteItemAsync: async (key: string) => {
    storage.delete(key);
  },
}));

const pactDir = path.resolve('pacts');
const pact = new Pact({
  consumer: 'ganapps-mobile',
  provider: 'ganapps-server',
  dir: pactDir,
  logLevel: 'warn',
});
const {
  atLeastLike,
  boolean,
  eachLike,
  fromProviderState,
  integer,
  number,
  regex,
  string,
}: Pick<
  typeof MatchersV3,
  'atLeastLike' | 'boolean' | 'eachLike' | 'fromProviderState' | 'integer' | 'number' | 'regex' | 'string'
> = MatchersV3;
const responseHeaders = { 'Content-Type': 'application/json; charset=utf-8' };
const authHeaders = { Authorization: 'Bearer pact-token' };
const credentials = {
  email: 'user@example.com',
  password: 'SecurePassword123!',
};
const tokens = {
  accessToken: string('access-token'),
  refreshToken: string('refresh-token'),
  expiresIn: integer(900),
};
const user = {
  id: string('user-1'),
  email: string('user@example.com'),
  username: string('user'),
  interests: atLeastLike(string('music'), 0, 1),
  isVerified: boolean(true),
  createdAt: string('2026-01-01T00:00:00.000Z'),
};

async function client(
  url: string,
  authenticated = false,
): Promise<{
  authAPI: typeof authAPI;
  chatAPI: typeof chatAPI;
  friendsAPI: typeof friendsAPI;
  ganapsAPI: typeof ganapsAPI;
  refreshAccessToken: typeof refreshAccessToken;
  useAuthStore: typeof useAuthStore;
}> {
  vi.stubEnv('EXPO_PUBLIC_API_URL', `${url}/api/v1`);
  vi.resetModules();
  const { useAuthStore } = await import('../src/store/auth.store');
  if (authenticated)
    useAuthStore.setState({
      token: 'pact-token',
      expiresAt: Date.now() + 900000,
    });
  const { authAPI } = await import('../src/api/endpoints/auth');
  const { chatAPI } = await import('../src/api/endpoints/chat');
  const { friendsAPI } = await import('../src/api/endpoints/friends');
  const { ganapsAPI } = await import('../src/api/endpoints/ganaps');
  const { refreshAccessToken } = await import('../src/api/interceptors/refresh-token');
  return { authAPI, chatAPI, friendsAPI, ganapsAPI, refreshAccessToken, useAuthStore };
}

beforeAll(() => {
  mkdirSync(pactDir, { recursive: true });
  rmSync(path.join(pactDir, 'ganapps-mobile-ganapps-server.json'), {
    force: true,
  });
});

afterEach(() => {
  storage.clear();
  vi.unstubAllEnvs();
});

describe('mobile to server contract', () => {
  it('signs in and unwraps the session tokens', async () => {
    await pact
      .addInteraction()
      .given('a user can sign in')
      .uponReceiving('a mobile login request')
      .withRequest('POST', '/api/v1/auth/login', (request) => {
        request.headers({ 'Content-Type': 'application/json' }).jsonBody(credentials);
      })
      .willRespondWith(200, (response) => {
        response.headers(responseHeaders).jsonBody({ success: true, statusCode: 200, data: tokens });
      })
      .executeTest(async ({ url }) => {
        const { authAPI } = await client(url);
        await expect(authAPI.login(credentials)).resolves.toEqual({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
        });
      });
  });

  it('returns the server error for invalid credentials', async () => {
    const input = { ...credentials, password: 'wrong-password' };
    await pact
      .addInteraction()
      .given('a user can sign in')
      .uponReceiving('a mobile login request with an incorrect password')
      .withRequest('POST', '/api/v1/auth/login', (request) => {
        request.headers({ 'Content-Type': 'application/json' }).jsonBody(input);
      })
      .willRespondWith(401, (response) => {
        response.headers(responseHeaders).jsonBody({
          success: false,
          statusCode: 401,
          errorCode: 'UNAUTHORIZED',
          message: string('Invalid email or password'),
        });
      })
      .executeTest(async ({ url }) => {
        const { authAPI } = await client(url);
        await expect(authAPI.login(input)).rejects.toMatchObject({
          status: 401,
          errorCode: 'UNAUTHORIZED',
        });
      });
  });

  it('registers a user and returns the session and user', async () => {
    const input = {
      email: 'new@example.com',
      password: credentials.password,
      username: 'newuser',
    };
    await pact
      .addInteraction()
      .given('a user can register')
      .uponReceiving('a mobile registration request')
      .withRequest('POST', '/api/v1/auth/register', (request) => {
        request.headers({ 'Content-Type': 'application/json' }).jsonBody(input);
      })
      .willRespondWith(201, (response) => {
        response.headers(responseHeaders).jsonBody({
          success: true,
          statusCode: 201,
          data: { ...tokens, user: { ...user, isVerified: boolean(false) } },
        });
      })
      .executeTest(async ({ url }) => {
        const { authAPI } = await client(url);
        await expect(authAPI.register(input)).resolves.toMatchObject({
          accessToken: 'access-token',
          user: { id: 'user-1' },
        });
      });
  });

  it('returns the signed-in user with the bearer token', async () => {
    await pact
      .addInteraction()
      .given('a user is signed in')
      .uponReceiving('a mobile profile request')
      .withRequest('GET', '/api/v1/auth/me', (request) => {
        request.headers(authHeaders);
      })
      .willRespondWith(200, (response) => {
        response.headers(responseHeaders).jsonBody({ success: true, statusCode: 200, data: user });
      })
      .executeTest(async ({ url }) => {
        const { authAPI } = await client(url, true);
        await expect(authAPI.getMe()).resolves.toMatchObject({
          id: 'user-1',
          email: 'user@example.com',
        });
      });
  });

  it('rotates and stores a refresh token', async () => {
    await pact
      .addInteraction()
      .given('a user has a valid refresh token')
      .uponReceiving('a mobile refresh request')
      .withRequest('POST', '/api/v1/auth/refresh', (request) => {
        request.headers({ 'Content-Type': 'application/json' }).jsonBody({
          // biome-ignore lint/suspicious/noTemplateCurlyInString: Pact substitutes the provider's signed token.
          refreshToken: fromProviderState('${refreshToken}', 'pact-refresh-token'),
        });
      })
      .willRespondWith(200, (response) => {
        response.headers(responseHeaders).jsonBody({ success: true, statusCode: 200, data: tokens });
      })
      .executeTest(async ({ url }) => {
        const { refreshAccessToken, useAuthStore } = await client(url);
        await expect(refreshAccessToken('pact-refresh-token')).resolves.toMatchObject({ accessToken: 'access-token' });
        await vi.waitFor(() => expect(useAuthStore.getState().token).toBe('access-token'));
        expect(storage.get('ganapps_refresh_token')).toBe('refresh-token');
      });
  });

  it('sends the account deletion confirmation and idempotency key', async () => {
    await pact
      .addInteraction()
      .given('a user can delete their account')
      .uponReceiving('a mobile account deletion request')
      .withRequest('DELETE', '/api/v1/auth/me', (request) => {
        request
          .headers({
            ...authHeaders,
            'Content-Type': 'application/json',
            'Idempotency-Key': 'deletion-request-1',
          })
          .jsonBody({ confirmationPhrase: 'DELETE MY ACCOUNT' });
      })
      .willRespondWith(202, (response) => {
        response.headers(responseHeaders).jsonBody({
          success: true,
          statusCode: 202,
          data: {
            status: 'DELETED',
            deletedAt: string('2026-01-01T00:00:00.000Z'),
            firebaseIdentityDeletion: 'NOT_LINKED',
          },
        });
      })
      .executeTest(async ({ url }) => {
        const { authAPI } = await client(url, true);
        await expect(authAPI.deleteAccount('DELETE MY ACCOUNT', 'deletion-request-1')).resolves.toMatchObject({
          status: 'DELETED',
          firebaseIdentityDeletion: 'NOT_LINKED',
        });
      });
  });

  it('loads the registration form for a Ganap', async () => {
    await pact
      .addInteraction()
      .given('a Ganap has a registration form')
      .uponReceiving('a mobile registration form request')
      .withRequest('GET', '/api/v1/ganaps/ganap-1/form-blocks', (request) => {
        request.headers(authHeaders).query({ scope: 'REGISTRATION' });
      })
      .willRespondWith(200, (response) => {
        response.headers(responseHeaders).jsonBody({
          success: true,
          statusCode: 200,
          data: eachLike({
            id: string('block-1'),
            ganapId: string('ganap-1'),
            scope: 'REGISTRATION',
            type: 'TEXT',
            label: string('What should we know?'),
            isRequired: boolean(true),
            allowMultiple: boolean(false),
            order: integer(0),
            options: [],
          }),
        });
      })
      .executeTest(async ({ url }) => {
        const { ganapsAPI } = await client(url, true);
        await expect(ganapsAPI.listFormBlocks('ganap-1', 'REGISTRATION')).resolves.toMatchObject([
          { id: 'block-1', scope: 'REGISTRATION', type: 'TEXT' },
        ]);
      });
  });

  it('joins a Ganap and returns the server registration status', async () => {
    await pact
      .addInteraction()
      .given('a user can join a published Ganap')
      .uponReceiving('a mobile Ganap join request')
      .withRequest('POST', '/api/v1/ganaps/join-ganap/join', (request) => {
        request.headers(authHeaders);
      })
      .willRespondWith(201, (response) => {
        response.headers(responseHeaders).jsonBody({
          success: true,
          statusCode: 201,
          data: {
            id: string('registration-1'),
            userId: string('user-1'),
            ganapId: string('join-ganap'),
            status: 'REGISTERED',
            requiresForm: false,
            createdAt: string('2026-01-01T00:00:00.000Z'),
          },
        });
      })
      .executeTest(async ({ url }) => {
        const { ganapsAPI } = await client(url, true);
        await expect(ganapsAPI.join('join-ganap')).resolves.toMatchObject({
          id: 'registration-1',
          status: 'REGISTERED',
          requiresForm: false,
        });
      });
  });

  it('sends the scanned QR code and scan time for check-in', async () => {
    const input = { qrHash: 'pact-qr-code', scannedAt: '2026-01-02T00:00:00.000Z' };
    await pact
      .addInteraction()
      .given('a registered user can check in')
      .uponReceiving('a mobile Ganap check-in request')
      .withRequest('POST', '/api/v1/ganaps/checkin-ganap/check-in', (request) => {
        request.headers({ ...authHeaders, 'Content-Type': 'application/json' }).jsonBody(input);
      })
      .willRespondWith(201, (response) => {
        response.headers(responseHeaders).jsonBody({
          success: true,
          statusCode: 201,
          data: {
            id: string('registration-1'),
            userId: string('user-1'),
            ganapId: string('checkin-ganap'),
            status: 'ATTENDED',
            createdAt: string('2026-01-01T00:00:00.000Z'),
          },
        });
      })
      .executeTest(async ({ url }) => {
        const { ganapsAPI } = await client(url, true);
        await expect(ganapsAPI.checkIn('checkin-ganap', input)).resolves.toMatchObject({
          id: 'registration-1',
          status: 'ATTENDED',
        });
      });
  });

  it('loads the signed-in user Friend Code', async () => {
    await pact
      .addInteraction()
      .given('a user has a Friend Code')
      .uponReceiving('a mobile Friend Code request')
      .withRequest('GET', '/api/v1/friends/code', (request) => {
        request.headers(authHeaders);
      })
      .willRespondWith(200, (response) => {
        response.headers(responseHeaders).jsonBody({
          success: true,
          statusCode: 200,
          data: {
            code: regex('^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{12}$', '0123456789AB'),
            issuedAt: string('2026-01-01T00:00:00.000Z'),
          },
        });
      })
      .executeTest(async ({ url }) => {
        const { friendsAPI } = await client(url, true);
        const result = await friendsAPI.getCode();
        expect(result).toEqual({
          code: '0123456789AB',
          issuedAt: '2026-01-01T00:00:00.000Z',
        });
        expect(isValidFriendCode(result.code)).toBe(true);
      });
  });

  it('requests a short-lived Chat socket ticket', async () => {
    await pact
      .addInteraction()
      .given('a verified user can connect to Chat')
      .uponReceiving('a mobile Chat socket ticket request')
      .withRequest('POST', '/api/v1/chat/socket-ticket', (request) => {
        request.headers(authHeaders);
      })
      .willRespondWith(200, (response) => {
        response.headers(responseHeaders).jsonBody({
          success: true,
          statusCode: 200,
          data: { ticket: string('socket-ticket'), expiresIn: integer(60) },
        });
      })
      .executeTest(async ({ url }) => {
        const { chatAPI } = await client(url, true);
        await expect(chatAPI.getSocketTicket()).resolves.toEqual({ ticket: 'socket-ticket', expiresIn: 60 });
      });
  });

  it('loads a filtered page of published Ganaps', async () => {
    await pact
      .addInteraction()
      .given('published Ganaps match the search')
      .uponReceiving('a mobile Ganap discovery request')
      .withRequest('GET', '/api/v1/ganaps', (request) => {
        request.query({ search: 'music', tag: 'community', limit: '5' });
      })
      .willRespondWith(200, (response) => {
        response.headers(responseHeaders).jsonBody({
          success: true,
          statusCode: 200,
          data: {
            items: eachLike({
              id: string('ganap-1'),
              title: string('Example Ganap'),
              businessId: string('business-1'),
              businessName: string('Example Business'),
              locationLat: number(10.7),
              locationLong: number(122.5),
              startDate: string('2026-01-01T00:00:00.000Z'),
              tags: eachLike(string('community')),
              registrationCount: integer(0),
            }),
            pagination: {
              total: integer(1),
              cursor: null,
              nextCursor: null,
              limit: integer(5),
            },
          },
        });
      })
      .executeTest(async ({ url }) => {
        const { ganapsAPI } = await client(url);
        await expect(ganapsAPI.list({ search: 'music', tag: 'community', limit: 5 })).resolves.toMatchObject({
          items: [{ id: 'ganap-1', title: 'Example Ganap' }],
          pagination: { total: 1, limit: 5 },
        });
      });
  });
});
