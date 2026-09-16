import { describe, expect, it, jest } from '@jest/globals';

// `src/db/index.ts` calls `openDatabaseSync` at module load, which needs the
// native SQLite module Jest does not have. Importing anything from
// `sync.service` therefore fails to load without this stub.
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: (): Record<string, unknown> => ({}),
}));

import { classifyReplayError } from './sync.service';

/** Builds the error shape `parseApiError` produces for a given status. */
function apiError(status: number): Error & { status?: number } {
  const error = new Error('failed') as Error & { status?: number };
  error.status = status;
  return error;
}

/** Builds the error shape `parseApiError` produces for a given message and status. */
function serverError(message: string, status: number): Error & { status?: number } {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

describe('classifyReplayError', () => {
  describe('toggles (like/unlike/save/unsave) keep their idempotent semantics', () => {
    it('treats 400 and 404 as success for every toggle action', () => {
      for (const action of ['like', 'unlike', 'save', 'unsave'] as const) {
        expect(classifyReplayError(action, apiError(400))).toBe('success');
        expect(classifyReplayError(action, apiError(404))).toBe('success');
      }
    });

    it('retries a toggle on server error or transport failure', () => {
      expect(classifyReplayError('like', apiError(500))).toBe('retry');
      expect(classifyReplayError('like', new Error('Network Error'))).toBe('retry');
    });
  });

  describe('check-in', () => {
    it('treats "Already checked in" as success — the intent already holds', () => {
      expect(classifyReplayError('check-in', serverError('Already checked in', 400))).toBe('success');
    });

    it('fails immediately on any other deterministic rejection, without retry', () => {
      expect(classifyReplayError('check-in', serverError('Invalid QR code', 400))).toBe('failed');
      expect(classifyReplayError('check-in', serverError('Event has no active QR code', 400))).toBe('failed');
      expect(classifyReplayError('check-in', serverError('Not registered for this event', 404))).toBe('failed');
    });

    it('retries transport and server errors', () => {
      expect(classifyReplayError('check-in', new Error('Network Error'))).toBe('retry');
      expect(classifyReplayError('check-in', serverError('boom', 500))).toBe('retry');
    });

    it('retries when the error is not an object at all', () => {
      expect(classifyReplayError('check-in', null)).toBe('retry');
      expect(classifyReplayError('check-in', 'offline')).toBe('retry');
    });
  });
});
