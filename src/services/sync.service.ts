import { and, eq, inArray, isNull, ne, notInArray, type SQL, sql } from 'drizzle-orm';
import { AppState, type AppStateStatus } from 'react-native';
import { ganapsAPI } from '@/api/endpoints/ganaps';
import { db } from '@/db';
import { outbox } from '@/db/schema';
import { useAuthStore } from '@/store/auth.store';
import { type ConnectionState, selectConnectionStatus, useConnectionStore } from '@/store/connection.store';
import { isNetworkFailure } from '@/utils/query-failure';

type OutboxAction = 'like' | 'unlike' | 'save' | 'unsave' | 'check-in';

/** A queueable like, unlike, save or unsave. */
export type ToggleAction = Exclude<OutboxAction, 'check-in'>;

/** A like, unlike, save or unsave made by one user on one Ganap. */
export interface ToggleCommand {
  action: ToggleAction;
  ganapId: string;
  ownerId: string;
}
type OutboxCommand =
  | { action: ToggleAction; ganapId: string; ownerId: string }
  | { action: 'check-in'; ganapId: string; ownerId: string; qrHash: string; scannedAt: string };
type OutboxInput =
  | { action: ToggleAction; ganapId: string; ownerId: string }
  | { action: 'check-in'; ganapId: string; ownerId: string; qrHash: string; scannedAt: string };

const DRAIN_BATCH = 10;

const MAX_RETRIES = 3;

/** Toggles that cancel each other out, so only the newest queued one needs sending. */
const TOGGLE_PAIRS: Record<ToggleAction, ToggleAction[]> = {
  like: ['like', 'unlike'],
  unlike: ['like', 'unlike'],
  save: ['save', 'unsave'],
  unsave: ['save', 'unsave'],
};

let outboxDrainPromise: Promise<void> | null = null;
let outboxDrainRequested = false;
let registeredListeners: OutboxReplayListeners = {};

/** Ganaps whose queued like or save settled since the last full drain pass. */
const settledToggleIds = new Set<string>();

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

/** Callback fired with the Ganaps whose queued likes or saves settled during a drain. */
export type TogglesReplayListener = (ganapIds: string[]) => void;

/** What the outbox drain reports as queued actions reach a final state. */
export interface OutboxReplayListeners {
  /** Called when a queued attendance scan succeeds or permanently fails. */
  onCheckInSettled?: CheckInReplayListener;
  /**
   * Called once a drain has sent everything it could reach, with the Ganaps whose
   * likes or saves succeeded or permanently failed. Held back while a request gets
   * no response, so a refresh cannot wipe the state of a like still waiting.
   */
  onTogglesSettled?: TogglesReplayListener;
}

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
 * Reads a text field from an outbox row's JSON payload in SQL.
 *
 * @param field - The payload field to read
 * @returns The field's value, or null when the payload is malformed or the field is not text
 */
function payloadText(field: 'ganapId' | 'ownerId'): SQL<string | null> {
  const path = `$.${field}`;
  return sql<
    string | null
  >`CASE WHEN json_valid(${outbox.payload}) THEN CASE WHEN json_type(${outbox.payload}, ${path}) = 'text' THEN json_extract(${outbox.payload}, ${path}) END END`;
}

/**
 * Queues an action for replay when connectivity returns.
 *
 * A like, unlike, save or unsave replaces any older queued one of the same kind
 * for that Ganap and owner, since only the newest is still the user's intent.
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
  if (command.action !== 'check-in') {
    await supersedeQueuedToggles(id, command).catch((): void => undefined);
  }
  return true;
}

/**
 * Matches pending rows of the same toggle pair, Ganap and owner as a command.
 *
 * @param command - The like, unlike, save or unsave to match
 * @returns The SQL condition
 */
function pendingToggleRows(command: ToggleCommand): SQL | undefined {
  return and(
    eq(outbox.status, 'pending'),
    eq(outbox.entityType, 'ganap'),
    inArray(outbox.action, TOGGLE_PAIRS[command.action]),
    eq(payloadText('ganapId'), command.ganapId),
    eq(payloadText('ownerId'), command.ownerId),
  );
}

/**
 * Removes older queued toggles that the newest one replaces.
 *
 * The server answers a like it already has, or an unlike it has nothing to
 * remove, with a 400 or 404 that the replay counts as success, so sending only
 * the newest toggle still ends in the state the user chose. If this delete
 * fails, every row stays and the drain sends them oldest first, so the newest
 * normally lands last.
 *
 * @param keepId - Id of the row just queued
 * @param command - The toggle just queued
 * @returns Nothing
 */
async function supersedeQueuedToggles(keepId: string, command: ToggleCommand): Promise<void> {
  await db.delete(outbox).where(and(pendingToggleRows(command), ne(outbox.id, keepId)));
}

/**
 * Queues a like or save behind an older queued one for the same Ganap, if there is one.
 *
 * Sent straight to the server instead, it would race the queued row, which the
 * server has not seen yet: an unlike would be refused, and the queued like would
 * then land. Queued, it replaces the older row and the drain sends it in order.
 *
 * @param command - The toggle the user just made
 * @returns True when it was queued; false when nothing is queued for that Ganap, so it should be sent now
 */
export async function queueBehindPendingToggle(command: ToggleCommand): Promise<boolean> {
  const pending = await db.select({ id: outbox.id }).from(outbox).where(pendingToggleRows(command)).limit(1);
  if (pending.length === 0) return false;
  if (!(await enqueueOutbox(command))) return false;
  requestOutboxDrain();
  return true;
}

/**
 * Starts a drain with the listeners the app registered, or joins the one running.
 *
 * @returns Nothing
 */
export function requestOutboxDrain(): void {
  void syncOutbox(registeredListeners);
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
 * Replays pending queued actions against the server, oldest first.
 *
 * Nothing is sent while the device reports no connection. A request that gets
 * no response leaves its row pending without using up an attempt, and ends the
 * pass, since the rest would fail the same way. Other failures are decided per
 * action by {@link classifyReplayError}; retryable ones try up to
 * {@link MAX_RETRIES} attempts. When an action settles either way, the
 * matching listener is told the truth: a rejected replay is never reported as
 * success.
 *
 * @param listeners - Called as queued attendance scans, likes and saves settle
 * @returns Nothing
 */
export function syncOutbox(listeners: OutboxReplayListeners = {}): Promise<void> {
  if (outboxDrainPromise) {
    outboxDrainRequested = true;
    return outboxDrainPromise;
  }
  outboxDrainRequested = false;
  outboxDrainPromise = drainOutbox(listeners).finally(() => {
    outboxDrainPromise = null;
    outboxDrainRequested = false;
  });
  return outboxDrainPromise;
}

async function drainOutbox(listeners: OutboxReplayListeners): Promise<void> {
  const attemptedByOwner = new Map<string, Set<string>>();
  do {
    outboxDrainRequested = false;
    if (!useConnectionStore.getState().isDeviceOnline) return;
    const { isHydrated, token, user } = useAuthStore.getState();
    if (!isHydrated || !token || !user?.id) return;

    let attemptedIds = attemptedByOwner.get(user.id);
    if (!attemptedIds) {
      attemptedIds = new Set();
      attemptedByOwner.set(user.id, attemptedIds);
    }
    const result: BatchResult = await drainOutboxBatch(user.id, attemptedIds, listeners);
    /** A trigger that arrived during a request that got no response, such as the connection returning, tries again. */
    if (result === 'no-response' && !outboxDrainRequested) return;
    if (result === 'more') outboxDrainRequested = true;
  } while (outboxDrainRequested);

  flushSettledToggles(listeners);
}

/**
 * Reports the Ganaps whose queued likes or saves settled, once per full pass.
 *
 * @param listeners - The drain's listeners
 * @returns Nothing
 */
function flushSettledToggles(listeners: OutboxReplayListeners): void {
  if (settledToggleIds.size === 0) return;
  const ganapIds: string[] = [...settledToggleIds];
  settledToggleIds.clear();
  listeners.onTogglesSettled?.(ganapIds);
}

/** How a drain batch ended: a request got no response, the batch was full, or the queue is done. */
type BatchResult = 'no-response' | 'more' | 'done';

/**
 * Replays one batch of the current owner's pending rows, oldest first.
 *
 * @param ownerId - The signed-in user whose rows are replayed
 * @param attemptedIds - Rows already tried in this drain, which are skipped
 * @param listeners - Called as queued actions settle
 * @returns `no-response` when a request got no response, so the drain should stop; `more` when the batch was full
 */
async function drainOutboxBatch(
  ownerId: string,
  attemptedIds: Set<string>,
  listeners: OutboxReplayListeners,
): Promise<BatchResult> {
  const ownerIdExpression = payloadText('ownerId');
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
    .orderBy(sql`rowid`)
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
      .orderBy(sql`rowid`)
      .limit(legacyLimit);
    pendingItems.push(...legacyItems);
  }

  for (const item of pendingItems) {
    if (!isCurrentOutboxOwner(ownerId)) return 'done';
    attemptedIds.add(item.id);
    const itemOwnerId = readOwnerId(item);
    if (itemOwnerId !== null && itemOwnerId !== ownerId) continue;
    const reachedServer: boolean = await processPendingOutboxItem(item, ownerId, listeners);
    if (!reachedServer) {
      attemptedIds.delete(item.id);
      return 'no-response';
    }
  }
  return pendingItems.length === DRAIN_BATCH ? 'more' : 'done';
}

/**
 * Replays one pending row and records how it settled.
 *
 * A row a newer toggle replaced after the batch was read is skipped.
 *
 * @param item - The pending outbox row
 * @param ownerId - The signed-in user replaying it
 * @param listeners - Called when the action settles
 * @returns False when the request got no response; the row stays pending with its attempts unchanged
 */
async function processPendingOutboxItem(
  item: typeof outbox.$inferSelect,
  ownerId: string,
  listeners: OutboxReplayListeners,
): Promise<boolean> {
  if (!isCurrentOutboxOwner(ownerId)) return true;
  const retries = (item.retries ?? 0) + 1;
  const action: OutboxAction | null = isOutboxAction(item.action) ? item.action : null;
  if (action === null) {
    await db
      .update(outbox)
      .set({ status: 'failed', retries, updatedAt: new Date() })
      .where(and(eq(outbox.id, item.id), eq(outbox.status, 'pending')));
    return true;
  }

  const notify = (recorded: boolean, error?: Error): void => {
    const ganapId = readGanapId(item);
    if (ganapId === null) return;
    if (action === 'check-in') listeners.onCheckInSettled?.({ ganapId, recorded, error });
    else settledToggleIds.add(ganapId);
  };

  const stillPending = await db
    .select({ id: outbox.id })
    .from(outbox)
    .where(and(eq(outbox.id, item.id), eq(outbox.status, 'pending')))
    .limit(1);
  if (stillPending.length === 0) return true;

  try {
    await processOutboxItem(parseOutboxCommand(item, action), ownerId);
    if (!isCurrentOutboxOwner(ownerId)) return true;
    await db
      .update(outbox)
      .set({ status: 'success', updatedAt: new Date() })
      .where(and(eq(outbox.id, item.id), eq(outbox.status, 'pending')));
    notify(true);
  } catch (error) {
    if (!isCurrentOutboxOwner(ownerId)) return true;
    if (error instanceof Error && isNetworkFailure(error)) return false;
    await handleReplayFailure(item, retries, action, error, ownerId, notify);
  }
  return true;
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
 * Starts draining the outbox whenever the app returns to the foreground or the
 * connection comes back.
 *
 * Drains once immediately as well, so a queue left over from a previous session
 * is not stuck waiting for a backgrounding that may never come. The connection
 * counts as back when the device reconnects, or when a request gets a response
 * again after an unstable spell.
 *
 * @param listeners - Forwarded to every drain pass; see {@link syncOutbox}
 * @returns A function that stops both listeners
 */
export function startOutboxDrain(listeners: OutboxReplayListeners = {}): () => void {
  registeredListeners = listeners;
  const subscription = AppState.addEventListener('change', (state: AppStateStatus): void => {
    if (state === 'active') {
      void syncOutbox(listeners);
    }
  });
  const unsubscribeConnection = useConnectionStore.subscribe(
    (state: ConnectionState, previous: ConnectionState): void => {
      if (selectConnectionStatus(state) === 'online' && selectConnectionStatus(previous) !== 'online') {
        void syncOutbox(listeners);
      }
    },
  );

  void syncOutbox(listeners);

  return (): void => {
    subscription.remove();
    unsubscribeConnection();
    if (registeredListeners === listeners) registeredListeners = {};
  };
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
