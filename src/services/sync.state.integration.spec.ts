import type { SQLInputValue } from 'node:sqlite';
import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({
  db: undefined as unknown,
  session: {
    isHydrated: false,
    token: null as string | null,
    user: null as { id: string } | null,
  },
  api: {
    like: vi.fn(),
    unlike: vi.fn(),
    save: vi.fn(),
    unsave: vi.fn(),
    checkIn: vi.fn(),
  },
}));

vi.mock('@/db', () => ({
  get db(): unknown {
    return runtime.db;
  },
}));
vi.mock('@/store/auth.store', () => ({ useAuthStore: { getState: () => runtime.session } }));
vi.mock('@/api/endpoints/ganaps', () => ({ ganapsAPI: runtime.api }));
vi.mock('react-native', () => ({ AppState: { addEventListener: () => ({ remove: vi.fn() }) } }));

describe('mobile outbox state transitions', () => {
  let sqlite: DatabaseSync;
  let service: typeof import('./sync.service');

  beforeEach(async () => {
    sqlite = new DatabaseSync(':memory:');
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
      if (method === 'get') {
        const row = statement.get(...bindings);
        return { rows: row ? Object.values(row) : [] };
      }
      const rows = statement.all(...bindings).map((row) => Object.values(row));
      return { rows };
    });
    runtime.session.isHydrated = true;
    runtime.session.token = 'access-token-a';
    runtime.session.user = { id: 'user-a' };
    runtime.api.like.mockReset().mockResolvedValue(undefined);
    runtime.api.unlike.mockReset().mockResolvedValue(undefined);
    runtime.api.save.mockReset().mockResolvedValue(undefined);
    runtime.api.unsave.mockReset().mockResolvedValue(undefined);
    runtime.api.checkIn.mockReset().mockResolvedValue(undefined);
    vi.resetModules();
    service = await import('./sync.service');
  });

  afterEach(() => {
    sqlite.close();
    runtime.db = undefined;
  });

  it('does not queue a replay without an authenticated owner', async () => {
    runtime.session.token = null;
    runtime.session.user = null;

    await expect(service.enqueueOutbox('ganap', 'like', { ganapId: 'ganap-1' })).resolves.toBe(false);
    expect(sqlite.prepare('SELECT id FROM outbox').all()).toHaveLength(0);
  });

  it('waits for hydrated auth and replays only for the queued owner', async () => {
    await expect(
      service.enqueueOutbox('ganap', 'check-in', {
        ganapId: 'ganap-1',
        qrHash: 'qr-hash',
        scannedAt: '2026-11-01T00:00:00.000Z',
      }),
    ).resolves.toBe(true);

    runtime.session.isHydrated = false;
    runtime.session.token = null;
    runtime.session.user = null;
    await service.syncOutbox();
    expect(outboxRow(sqlite).status).toBe('pending');
    expect(runtime.api.checkIn).not.toHaveBeenCalled();

    runtime.session.isHydrated = true;
    runtime.session.token = 'access-token-b';
    runtime.session.user = { id: 'user-b' };
    await service.syncOutbox();
    expect(outboxRow(sqlite).status).toBe('pending');
    expect(runtime.api.checkIn).not.toHaveBeenCalled();

    runtime.session.token = 'access-token-a';
    runtime.session.user = { id: 'user-a' };
    await service.syncOutbox();
    expect(outboxRow(sqlite).status).toBe('success');
    expect(runtime.api.checkIn).toHaveBeenCalledTimes(1);
  });

  it('does not let foreign-owner rows starve the current owner past one batch', async () => {
    for (let index = 0; index < 11; index += 1) {
      sqlite
        .prepare(
          `INSERT INTO outbox (id, entity_type, action, payload, status, retries, created_at, updated_at)
           VALUES (?, 'ganap', 'like', ?, 'pending', 0, ?, ?)`,
        )
        .run(
          `foreign-${index}`,
          JSON.stringify({ ganapId: `foreign-${index}`, ownerId: 'user-b' }),
          Date.now(),
          Date.now(),
        );
    }
    await service.enqueueOutbox('ganap', 'like', { ganapId: 'ganap-user-a' });

    await service.syncOutbox();

    expect(runtime.api.like).toHaveBeenCalledTimes(1);
    expect(runtime.api.like).toHaveBeenCalledWith('ganap-user-a', 'user-a');
    expect(sqlite.prepare("SELECT status FROM outbox WHERE id LIKE 'foreign-%'").all()).toHaveLength(11);
  });

  it('serializes concurrent drains so a pending row is sent once', async () => {
    await service.enqueueOutbox('ganap', 'like', { ganapId: 'ganap-2' });
    let releaseRequest: (() => void) | undefined;
    runtime.api.like.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseRequest = resolve;
        }),
    );

    const firstDrain = service.syncOutbox();
    await vi.waitFor(() => expect(runtime.api.like).toHaveBeenCalledTimes(1));
    const secondDrain = service.syncOutbox();
    releaseRequest?.();
    await Promise.all([firstDrain, secondDrain]);

    expect(runtime.api.like).toHaveBeenCalledTimes(1);
    expect(runtime.api.like).toHaveBeenCalledWith('ganap-2', 'user-a');
    expect(outboxRow(sqlite).status).toBe('success');
  });

  it('counts one retry when multiple drain triggers overlap a failed request', async () => {
    await service.enqueueOutbox('ganap', 'like', { ganapId: 'ganap-retry' });
    let rejectRequest: ((error: unknown) => void) | undefined;
    runtime.api.like.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectRequest = reject;
        }),
    );

    const firstDrain = service.syncOutbox();
    await vi.waitFor(() => expect(runtime.api.like).toHaveBeenCalledTimes(1));
    const secondDrain = service.syncOutbox();
    rejectRequest?.(new Error('temporary network failure'));
    await Promise.all([firstDrain, secondDrain]);

    expect(runtime.api.like).toHaveBeenCalledTimes(1);
    expect(outboxRow(sqlite)).toMatchObject({ status: 'pending', retries: 1 });
  });

  it('drains a new row queued during an active pass when another trigger arrives', async () => {
    await service.enqueueOutbox('ganap', 'like', { ganapId: 'ganap-first' });
    let releaseRequest: (() => void) | undefined;
    runtime.api.like.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseRequest = resolve;
        }),
    );

    const firstDrain = service.syncOutbox();
    await vi.waitFor(() => expect(runtime.api.like).toHaveBeenCalledTimes(1));
    await service.enqueueOutbox('ganap', 'like', { ganapId: 'ganap-second' });
    const overlappingTrigger = service.syncOutbox();
    releaseRequest?.();
    await Promise.all([firstDrain, overlappingTrigger]);

    expect(runtime.api.like).toHaveBeenCalledTimes(2);
    expect(runtime.api.like).toHaveBeenNthCalledWith(1, 'ganap-first', 'user-a');
    expect(runtime.api.like).toHaveBeenNthCalledWith(2, 'ganap-second', 'user-a');
    expect(sqlite.prepare("SELECT status FROM outbox WHERE status = 'success'").all()).toHaveLength(2);
  });
});

function outboxRow(database: DatabaseSync): { status: string; retries: number } {
  const row = database.prepare('SELECT status, retries FROM outbox LIMIT 1').get();
  if (!row) throw new Error('Expected one outbox row');
  return row as { status: string; retries: number };
}
