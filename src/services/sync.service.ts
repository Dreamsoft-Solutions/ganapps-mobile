import { and, eq, isNull, notInArray, sql } from 'drizzle-orm';
import { AppState, type AppStateStatus } from 'react-native';
import { ganapsAPI } from '@/api/endpoints/ganaps';
import { db } from '@/db';
import { outbox } from '@/db/schema';
import { useAuthStore } from '@/store/auth.store';

type OutboxAction = 'like' | 'unlike' | 'save' | 'unsave' | 'check-in';
type ToggleAction = Exclude<OutboxAction, 'check-in'>;
type OutboxCommand =
  | { action: ToggleAction; ganapId: string; ownerId: string }
  | { action: 'check-in'; ganapId: string; ownerId: string; qrHash: string; scannedAt: string };
type OutboxInput =
  | { action: ToggleAction; ganapId: string; ownerId: string }
  | { action: 'check-in'; ganapId: string; ownerId: string; qrHash: string; scannedAt: string };

const DRAIN_BATCH = 10;

const MAX_RETRIES = 3;

let outboxDrainPromise: Promise<void> | null = null;
let outboxDrainRequested = false;

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
 * @param command - A Ganap toggle or attendance scan to replay
 * @returns Whether the action had a captured owner and was queued
 */
export async function enqueueOutbox(command: OutboxInput): Promise<boolean> {
  if (!command.ownerId.trim()) return false;

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const { action, ...payload } = command;
  await db.insert(outbox).values({
    id,
    entityType: 'ganap',
    action,
    payload: JSON.stringify(payload),
    status: 'pending',
  });
  return true;
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

function readOwnerId(item: typeof outbox.$inferSelect): string | null {
  try {
    const raw = JSON.parse(item.payload) as { ownerId?: unknown };
    return typeof raw.ownerId === 'string' ? raw.ownerId : null;
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
export function syncOutbox(onCheckInSettled?: CheckInReplayListener): Promise<void> {
  if (outboxDrainPromise) {
    outboxDrainRequested = true;
    return outboxDrainPromise;
  }
  outboxDrainRequested = false;
  outboxDrainPromise = drainOutbox(onCheckInSettled).finally(() => {
    outboxDrainPromise = null;
    outboxDrainRequested = false;
  });
  return outboxDrainPromise;
}

async function drainOutbox(onCheckInSettled?: CheckInReplayListener): Promise<void> {
  const attemptedByOwner = new Map<string, Set<string>>();
  do {
    outboxDrainRequested = false;
    const { isHydrated, token, user } = useAuthStore.getState();
    if (!isHydrated || !token || !user?.id) return;

    let attemptedIds = attemptedByOwner.get(user.id);
    if (!attemptedIds) {
      attemptedIds = new Set();
      attemptedByOwner.set(user.id, attemptedIds);
    }
    await drainOutboxBatch(user.id, attemptedIds, onCheckInSettled);
  } while (outboxDrainRequested);
}

async function drainOutboxBatch(
  ownerId: string,
  attemptedIds: Set<string>,
  onCheckInSettled?: CheckInReplayListener,
): Promise<void> {
  const ownerIdExpression = sql<
    string | null
  >`CASE WHEN json_valid(${outbox.payload}) THEN CASE WHEN json_type(${outbox.payload}, '$.ownerId') = 'text' THEN json_extract(${outbox.payload}, '$.ownerId') END END`;
  const excludedIds = [...attemptedIds];
  const pendingItems = await db
    .select()
    .from(outbox)
    .where(
      and(
        eq(outbox.status, 'pending'),
        eq(ownerIdExpression, ownerId),
        excludedIds.length > 0 ? notInArray(outbox.id, excludedIds) : undefined,
      ),
    )
    .limit(DRAIN_BATCH);
  const legacyLimit = DRAIN_BATCH - pendingItems.length;
  if (legacyLimit > 0) {
    const legacyItems = await db
      .select()
      .from(outbox)
      .where(
        and(
          eq(outbox.status, 'pending'),
          isNull(ownerIdExpression),
          excludedIds.length > 0 ? notInArray(outbox.id, excludedIds) : undefined,
        ),
      )
      .limit(legacyLimit);
    pendingItems.push(...legacyItems);
  }

  for (const item of pendingItems) {
    if (!isCurrentOutboxOwner(ownerId)) return;
    attemptedIds.add(item.id);
    const itemOwnerId = readOwnerId(item);
    if (itemOwnerId !== null && itemOwnerId !== ownerId) continue;
    await processPendingOutboxItem(item, ownerId, onCheckInSettled);
  }
}

async function processPendingOutboxItem(
  item: typeof outbox.$inferSelect,
  ownerId: string,
  onCheckInSettled?: CheckInReplayListener,
): Promise<void> {
  if (!isCurrentOutboxOwner(ownerId)) return;
  const retries = (item.retries ?? 0) + 1;
  const action: OutboxAction | null = isOutboxAction(item.action) ? item.action : null;
  if (action === null) {
    await db
      .update(outbox)
      .set({ status: 'failed', retries, updatedAt: new Date() })
      .where(and(eq(outbox.id, item.id), eq(outbox.status, 'pending')));
    return;
  }

  const notify = (recorded: boolean, error?: Error): void => {
    if (action !== 'check-in' || !onCheckInSettled) return;
    const ganapId = readGanapId(item);
    if (ganapId !== null) onCheckInSettled({ ganapId, recorded, error });
  };

  try {
    await processOutboxItem(parseOutboxCommand(item, action), ownerId);
    if (!isCurrentOutboxOwner(ownerId)) return;
    await db
      .update(outbox)
      .set({ status: 'success', updatedAt: new Date() })
      .where(and(eq(outbox.id, item.id), eq(outbox.status, 'pending')));
    notify(true);
  } catch (error) {
    if (!isCurrentOutboxOwner(ownerId)) return;
    await handleReplayFailure(item, retries, action, error, ownerId, notify);
  }
}

async function handleReplayFailure(
  item: typeof outbox.$inferSelect,
  retries: number,
  action: OutboxAction,
  error: unknown,
  ownerId: string,
  notify: (recorded: boolean, error?: Error) => void,
): Promise<void> {
  if (!isCurrentOutboxOwner(ownerId)) return;
  const classification = classifyReplayError(action, error);
  if (classification === 'success') {
    await db
      .update(outbox)
      .set({ status: 'success', updatedAt: new Date() })
      .where(and(eq(outbox.id, item.id), eq(outbox.status, 'pending')));
    notify(true);
  } else if (classification === 'failed' || retries >= MAX_RETRIES) {
    await db
      .update(outbox)
      .set({ status: 'failed', retries, updatedAt: new Date() })
      .where(and(eq(outbox.id, item.id), eq(outbox.status, 'pending')));
    notify(false, error instanceof Error ? error : new Error(String(error)));
  } else {
    await db
      .update(outbox)
      .set({ retries, updatedAt: new Date() })
      .where(and(eq(outbox.id, item.id), eq(outbox.status, 'pending')));
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

function isCurrentOutboxOwner(ownerId: string): boolean {
  const session = useAuthStore.getState();
  return session.isHydrated && Boolean(session.token) && session.user?.id === ownerId;
}

/**
 * Identifies one action stored in the outbox table.
 *
 * @param action - Action read from persisted state
 * @returns Whether the action is supported
 */
function isOutboxAction(action: string): action is OutboxAction {
  return action === 'like' || action === 'unlike' || action === 'save' || action === 'unsave' || action === 'check-in';
}

/**
 * Parses and validates a persisted outbox command at the database boundary.
 *
 * @param item - The outbox row being replayed
 * @param action - Validated action stored on the row
 * @returns The typed Ganap command
 * @throws OutboxPayloadError when its entity or payload is malformed
 */
function parseOutboxCommand(item: typeof outbox.$inferSelect, action: OutboxAction): OutboxCommand {
  if (item.entityType !== 'ganap') {
    throw new OutboxPayloadError(`Unknown outbox entity type: ${item.entityType}`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(item.payload);
  } catch {
    throw new OutboxPayloadError(`Unparseable outbox payload for ${item.id}`);
  }
  if (typeof raw !== 'object' || raw === null || typeof (raw as { ganapId?: unknown }).ganapId !== 'string') {
    throw new OutboxPayloadError(`Outbox payload missing ganapId for ${item.id}`);
  }
  if (typeof (raw as { ownerId?: unknown }).ownerId !== 'string') {
    throw new OutboxPayloadError(`Outbox payload missing ownerId for ${item.id}`);
  }
  const ownerId = (raw as { ownerId: string }).ownerId;
  if (action === 'check-in') {
    const candidate = raw as { ganapId: string; qrHash?: unknown; scannedAt?: unknown };
    if (typeof candidate.qrHash !== 'string' || typeof candidate.scannedAt !== 'string') {
      throw new OutboxPayloadError(`Check-in payload missing fields for ${item.id}`);
    }
    return { action, ganapId: candidate.ganapId, ownerId, qrHash: candidate.qrHash, scannedAt: candidate.scannedAt };
  }
  return { action, ganapId: (raw as { ganapId: string }).ganapId, ownerId };
}

/**
 * Replays one queued item.
 *
 * @param command - A validated Ganap command
 * @returns Nothing
 * @throws When the user is unauthenticated
 */
async function processOutboxItem(command: OutboxCommand, ownerId: string): Promise<void> {
  if (command.ownerId !== ownerId) throw new OutboxPayloadError('Outbox item belongs to another user');
  if (!isCurrentOutboxOwner(ownerId)) throw new Error('Authenticated User changed before replay');

  await syncGanapAction(command, ownerId);
}

/**
 * Replays a single Ganap action.
 *
 * @param command - The persisted command to replay
 * @returns Nothing
 */
async function syncGanapAction(command: OutboxCommand, ownerId: string): Promise<void> {
  switch (command.action) {
    case 'like':
      await ganapsAPI.like(command.ganapId, ownerId);
      break;
    case 'unlike':
      await ganapsAPI.unlike(command.ganapId, ownerId);
      break;
    case 'save':
      await ganapsAPI.save(command.ganapId, ownerId);
      break;
    case 'unsave':
      await ganapsAPI.unsave(command.ganapId, ownerId);
      break;
    case 'check-in': {
      await ganapsAPI.checkIn(command.ganapId, { qrHash: command.qrHash, scannedAt: command.scannedAt }, ownerId);
      break;
    }
  }
}
