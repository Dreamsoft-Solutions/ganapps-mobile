import type { ChatMessage } from '@/types/chat.types';

/** Error fields added by the mobile API error normalizer. */
export interface ChatNormalizedError extends Error {
  status?: number;
  errorCode?: string;
}

/** Narrows an Error to the optional normalized API fields used by chat. */
export function asChatError(error: Error): ChatNormalizedError {
  return error as ChatNormalizedError;
}

/**
 * Returns whether an error means the server denied or removed chat access.
 *
 * A forbidden response is an authoritative access result, not a transient
 * network failure and therefore must not receive an automatic retry.
 *
 * @param error - Query or mutation error
 * @returns True for HTTP 403 or the normalized FORBIDDEN code
 */
export function isChatForbidden(error: Error | null | undefined): boolean {
  if (!error) return false;
  const normalized: ChatNormalizedError = asChatError(error);
  return normalized.status === 403 || normalized.errorCode === 'FORBIDDEN';
}

/**
 * Returns whether an error has no server status and therefore likely never
 * reached the API.
 *
 * @param error - Mutation error
 * @returns True for transport/setup failures
 */
export function isChatNetworkError(error: Error): boolean {
  return asChatError(error).status === undefined;
}

/**
 * Compares complete messages in the server's `(sentAt, id)` order.
 *
 * @param a - First message
 * @param b - Second message
 * @returns Positive when `a` is newer, negative when `b` is newer, or zero when equal
 */
export function compareChatMessages(a: ChatMessage, b: ChatMessage): number {
  return compareChatMessagePositions(a, b);
}

/**
 * Compares two message-like positions without requiring the full message payload.
 *
 * Summary projections and canonical messages share the same `(sentAt, id)` order,
 * so this keeps live summary patches from regressing when socket events arrive
 * out of order.
 *
 * @param a - First message position
 * @param b - Second message position
 * @returns Positive when `a` is newer, negative when `b` is newer, or zero when equal
 */
export function compareChatMessagePositions(
  a: Pick<ChatMessage, 'id' | 'sentAt'>,
  b: Pick<ChatMessage, 'id' | 'sentAt'>,
): number {
  const sentAtComparison: number = a.sentAt === b.sentAt ? 0 : a.sentAt > b.sentAt ? 1 : -1;
  return sentAtComparison !== 0 ? sentAtComparison : a.id === b.id ? 0 : a.id > b.id ? 1 : -1;
}

/**
 * Inserts or replaces a canonical message while preserving newest-first order.
 *
 * @param messages - Existing server or socket messages
 * @param incoming - Canonical message to reconcile
 * @returns De-duplicated newest-first messages
 */
export function upsertChatMessage(messages: ChatMessage[], incoming: ChatMessage): ChatMessage[] {
  const withoutIncoming: ChatMessage[] = messages.filter((message: ChatMessage): boolean => message.id !== incoming.id);
  return [incoming, ...withoutIncoming].sort((a: ChatMessage, b: ChatMessage): number => -compareChatMessages(a, b));
}

/** Returns the greatest loaded message by `(sentAt, id)`, or null when empty. */
export function greatestChatMessage(messages: ChatMessage[]): ChatMessage | null {
  return messages.reduce<ChatMessage | null>((greatest, message) => {
    if (!greatest || compareChatMessages(message, greatest) > 0) return message;
    return greatest;
  }, null);
}
