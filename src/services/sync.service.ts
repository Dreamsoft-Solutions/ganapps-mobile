import { eq } from 'drizzle-orm';
import { AppState, type AppStateStatus } from 'react-native';
import { ganapsAPI } from '@/api/endpoints/ganaps';
import { db } from '@/db';
import { outbox } from '@/db/schema';
import { useAuthStore } from '@/store/auth.store';

/** Actions that can be queued for replay. */
export type OutboxAction = 'like' | 'unlike' | 'save' | 'unsave';

/** How many queued items one drain pass attempts. */
const DRAIN_BATCH = 10;

/** Attempts before an item is abandoned as failed. */
const MAX_RETRIES = 3;

/**
 * Statuses meaning the queued action's end state already holds.
 *
 * The like and save endpoints are idempotent in effect but not in response: a
 * repeated POST returns 400 ("Already liked") and a DELETE for something already
 * gone returns 404. Both mean the student's intent is satisfied, so retrying
 * would burn attempts and then wrongly report failure.
 */
const TERMINAL_STATUSES = [400, 404];

/**
 * Decides whether a failed replay should stop rather than retry.
 *
 * @param error - The error thrown by the replayed request
 * @returns True when the action's end state already holds
 */
export function isTerminalOutboxError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;

  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' && TERMINAL_STATUSES.includes(status);
}

/**
 * Queues an action for replay when connectivity returns.
 *
 * @param entityType - Domain the action belongs to, currently only 'ganap'
 * @param action - Which action to replay
 * @param payload - Data the replay needs, serialised as JSON
 * @returns Nothing
 */
export async function enqueueOutbox(
  entityType: string,
  action: OutboxAction,
  payload: Record<string, unknown>,
): Promise<void> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  await db.insert(outbox).values({
    id,
    entityType,
    action,
    payload: JSON.stringify(payload),
    status: 'pending',
  });
}

/**
 * Replays pending queued actions against the server.
 *
 * Marks an item successful when its replay succeeds, or when the failure means
 * the end state already holds. Other failures retry up to {@link MAX_RETRIES}
 * attempts before the item is marked failed.
 *
 * @returns Nothing
 */
export async function syncOutbox(): Promise<void> {
  const pendingItems = await db.select().from(outbox).where(eq(outbox.status, 'pending')).limit(DRAIN_BATCH);

  for (const item of pendingItems) {
    const retries = (item.retries ?? 0) + 1;

    try {
      await processOutboxItem(item);
      await db.update(outbox).set({ status: 'success', updatedAt: new Date() }).where(eq(outbox.id, item.id));
    } catch (error) {
      if (isTerminalOutboxError(error)) {
        await db.update(outbox).set({ status: 'success', updatedAt: new Date() }).where(eq(outbox.id, item.id));
      } else if (retries >= MAX_RETRIES) {
        await db.update(outbox).set({ status: 'failed', retries, updatedAt: new Date() }).where(eq(outbox.id, item.id));
      } else {
        await db.update(outbox).set({ retries, updatedAt: new Date() }).where(eq(outbox.id, item.id));
      }
    }
  }
}

/**
 * Starts draining the outbox whenever the app returns to the foreground.
 *
 * Drains once immediately as well, so a queue left over from a previous session
 * is not stuck waiting for a backgrounding that may never come.
 *
 * @returns A function that stops the listener
 */
export function startOutboxDrain(): () => void {
  const subscription = AppState.addEventListener('change', (state: AppStateStatus): void => {
    if (state === 'active') {
      void syncOutbox();
    }
  });

  void syncOutbox();

  return (): void => subscription.remove();
}

/**
 * Replays one queued item.
 *
 * @param item - The outbox row to replay
 * @returns Nothing
 * @throws When the user is unauthenticated or the entity type is unknown
 */
async function processOutboxItem(item: typeof outbox.$inferSelect): Promise<void> {
  const token = useAuthStore.getState().token;
  if (!token) throw new Error('Not authenticated');

  const payload = JSON.parse(item.payload) as { ganapId: string };

  switch (item.entityType) {
    case 'ganap':
      await syncGanapAction(item.action as OutboxAction, payload.ganapId);
      break;
    default:
      throw new Error(`Unknown entity type: ${item.entityType}`);
  }
}

/**
 * Replays a single Ganap toggle.
 *
 * @param action - Which toggle to replay
 * @param ganapId - Id of the Ganap acted on
 * @returns Nothing
 * @throws When the action is unrecognised
 */
async function syncGanapAction(action: OutboxAction, ganapId: string): Promise<void> {
  switch (action) {
    case 'like':
      await ganapsAPI.like(ganapId);
      break;
    case 'unlike':
      await ganapsAPI.unlike(ganapId);
      break;
    case 'save':
      await ganapsAPI.save(ganapId);
      break;
    case 'unsave':
      await ganapsAPI.unsave(ganapId);
      break;
    default:
      throw new Error(`Unknown ganap action: ${action}`);
  }
}
