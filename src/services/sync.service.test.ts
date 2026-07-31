import { describe, expect, it, jest } from '@jest/globals';

// `src/db/index.ts` calls `openDatabaseSync` at module load, which needs the
// native SQLite module Jest does not have. Importing anything from
// `sync.service` therefore fails to load without this stub.
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: (): Record<string, unknown> => ({}),
}));

import { isTerminalOutboxError } from './sync.service';

/** Builds the error shape `parseApiError` produces for a given status. */
function apiError(status: number): Error & { status?: number } {
  const error = new Error('failed') as Error & { status?: number };
  error.status = status;
  return error;
}

describe('isTerminalOutboxError', () => {
  it('treats "already liked" (400) as terminal, not retryable', () => {
    expect(isTerminalOutboxError(apiError(400))).toBe(true);
  });

  it('treats "like not found" (404) as terminal, not retryable', () => {
    expect(isTerminalOutboxError(apiError(404))).toBe(true);
  });

  it('retries a server error', () => {
    expect(isTerminalOutboxError(apiError(500))).toBe(false);
  });

  it('retries a network error carrying no status', () => {
    expect(isTerminalOutboxError(new Error('Network Error'))).toBe(false);
  });

  it('retries when the error is not an object at all', () => {
    expect(isTerminalOutboxError(null)).toBe(false);
    expect(isTerminalOutboxError('offline')).toBe(false);
  });
});
