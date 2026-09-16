import { eq } from 'drizzle-orm';
import { AppState, type AppStateStatus } from 'react-native';
import { ganapsAPI } from '@/api/endpoints/ganaps';
import { db } from '@/db';
import { outbox } from '@/db/schema';
import { useAuthStore } from '@/store/auth.store';

/** Actions that can be queued for replay. */
export type OutboxAction = 'like' | 'unlike' | 'save' | 'unsave' | 'check-in';

/** How many queued items one drain pass attempts. */
const DRAIN_BATCH = 10;

/** Attempts before an item is abandoned as failed. */
const MAX_RETRIES = 3;

/** Result of a replayed offline attendance scan reaching a final state. */
export interface CheckInReplayOutcome {
  /** Ganap the scan belongs to. */
  ganapId: string;
  /** True when attendance is recorded (including "already recorded"). */
  recorded: boolean;
  /** The rejection, present when `recorded` is false. */
  error?: Error;
}

/** Callback fired when a replayed attendance scan settles. */
export type CheckInReplayListener = (outcome: CheckInReplayOutcome) => void;

/** Thrown when a queued payload cannot be parsed; permanently fails the item. */
class OutboxPayloadError extends Error {}

/**
 * Decides what a failed replay means for its queued item.
 *
 * Toggles are idempotent in effect but not in response: any 400/404 means the
 * student's intent already holds, so it is success. Check-in is different — a
 * deterministic rejection (wrong QR, ineligible status) cannot succeed on
 * retry and must fail immediately and honestly, while "Already checked in"
 * means the intent (attendance recorded) already holds. Transport and server
 * errors retry for every action.
 *
 * @param action - The queued action being replayed
 * @param error - The error thrown by the replayed request
 * @returns `success`, `failed`, or `retry`
 */
export function classifyReplayError(action: OutboxAction, error: unknown): 'success' | 'failed' | 'retry' {
  if (error instanceof OutboxPayloadError) return 'failed';
  if (typeof error !== 'object' || error === null) return 'retry';

  const status = (error as { status?: unknown }).status;
  if (typeof status !== 'number') return 'retry';

  if (action === 'check-in') {
    if ((error as { message?: unknown }).message === 'Already checked in') return 'success';
    if (status === 400 || status === 404) return 'failed';
    return 'retry';
  }

  return status === 400 || status === 404 ? 'success' : 'retry';
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
 * Reads the ganapId out of a queued item without trusting the payload shape.
 *
 * @param item - The outbox row
 * @returns The ganapId, or null when unreadable
 */
function readGanapId(item: typeof outbox.$inferSelect): string | null {
  try {
    const raw = JSON.parse(item.payload) as { ganapId?: unknown };
    return typeof raw.ganapId === 'string' ? raw.ganapId : null;
  } catch {
    return null;
  }
}

/**
 * Replays pending queued actions against the server.
 *
 * Success and failure are decided per action by {@link classifyReplayError};
 * retryable failures try up to {@link MAX_RETRIES} attempts. When an
 * attendance scan settles either way, `onCheckInSettled` is told the truth —
 * a rejected replay is never reported as success.
 *
 * @param onCheckInSettled - Called when a queued attendance scan succeeds or permanently fails
 * @returns Nothing
 */
export async function syncOutbox(onCheckInSettled?: CheckInReplayListener): Promise<void> {
  const pendingItems = await db.select().from(outbox).where(eq(outbox.status, 'pending')).limit(DRAIN_BATCH);

  for (const item of pendingItems) {
    const retries = (item.retries ?? 0) + 1;
    const action = item.action as OutboxAction;

    const notify = (recorded: boolean, error?: Error): void => {
      if (action !== 'check-in' || !onCheckInSettled) return;
      const ganapId = readGanapId(item);
      if (ganapId !== null) onCheckInSettled({ ganapId, recorded, error });
    };

    try {
      await processOutboxItem(item);
      await db.update(outbox).set({ status: 'success', updatedAt: new Date() }).where(eq(outbox.id, item.id));
      notify(true);
    } catch (error) {
      const classification = classifyReplayError(action, error);
      if (classification === 'success') {
        await db.update(outbox).set({ status: 'success', updatedAt: new Date() }).where(eq(outbox.id, item.id));
        notify(true);
      } else if (classification === 'failed' || retries >= MAX_RETRIES) {
        await db.update(outbox).set({ status: 'failed', retries, updatedAt: new Date() }).where(eq(outbox.id, item.id));
        notify(false, error instanceof Error ? error : new Error(String(error)));
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
 * @param onCheckInSettled - Forwarded to every drain pass; see {@link syncOutbox}
 * @returns A function that stops the listener
 */
export function startOutboxDrain(onCheckInSettled?: CheckInReplayListener): () => void {
  const subscription = AppState.addEventListener('change', (state: AppStateStatus): void => {
    if (state === 'active') {
      void syncOutbox(onCheckInSettled);
    }
  });

  void syncOutbox(onCheckInSettled);

  return (): void => subscription.remove();
}

/** Payload shape queued for the Ganap like/save toggles. */
interface TogglePayload {
  ganapId: string;
}

/** Payload shape queued for an offline attendance scan. */
interface CheckInPayload {
  ganapId: string;
  qrHash: string;
  scannedAt: string;
}

/**
 * Parses and validates a queued item's payload for its action.
 *
 * @param item - The outbox row being replayed
 * @returns The typed payload
 * @throws OutboxPayloadError when the payload is malformed for the action
 */
function parseOutboxPayload(item: typeof outbox.$inferSelect): TogglePayload | CheckInPayload {
  let raw: unknown;
  try {
    raw = JSON.parse(item.payload);
  } catch {
    throw new OutboxPayloadError(`Unparseable outbox payload for ${item.id}`);
  }
  if (typeof raw !== 'object' || raw === null || typeof (raw as { ganapId?: unknown }).ganapId !== 'string') {
    throw new OutboxPayloadError(`Outbox payload missing ganapId for ${item.id}`);
  }
  if (item.action === 'check-in') {
    const candidate = raw as { ganapId: string; qrHash?: unknown; scannedAt?: unknown };
    if (typeof candidate.qrHash !== 'string' || typeof candidate.scannedAt !== 'string') {
      throw new OutboxPayloadError(`Check-in payload missing fields for ${item.id}`);
    }
    return { ganapId: candidate.ganapId, qrHash: candidate.qrHash, scannedAt: candidate.scannedAt };
  }
  return { ganapId: (raw as { ganapId: string }).ganapId };
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

  const payload = parseOutboxPayload(item);

  switch (item.entityType) {
    case 'ganap':
      await syncGanapAction(item.action as OutboxAction, payload);
      break;
    default:
      throw new Error(`Unknown entity type: ${item.entityType}`);
  }
}

/**
 * Replays a single Ganap action.
 *
 * @param action - Which action to replay
 * @param payload - The parsed payload for the action
 * @returns Nothing
 * @throws When the action is unrecognised
 */
async function syncGanapAction(action: OutboxAction, payload: TogglePayload | CheckInPayload): Promise<void> {
  switch (action) {
    case 'like':
      await ganapsAPI.like(payload.ganapId);
      break;
    case 'unlike':
      await ganapsAPI.unlike(payload.ganapId);
      break;
    case 'save':
      await ganapsAPI.save(payload.ganapId);
      break;
    case 'unsave':
      await ganapsAPI.unsave(payload.ganapId);
      break;
    case 'check-in': {
      const checkIn = payload as CheckInPayload;
      await ganapsAPI.checkIn(checkIn.ganapId, { qrHash: checkIn.qrHash, scannedAt: checkIn.scannedAt });
      break;
    }
    default:
      throw new Error(`Unknown ganap action: ${action}`);
  }
}
