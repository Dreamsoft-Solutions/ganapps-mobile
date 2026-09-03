import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import { moderationQueryKeys } from '@/hooks/queries/useModerationQuery';
import type { BlockedUsersPage, ModerationReportReason } from '@/types/moderation.types';
import type { ChatNormalizedError } from './chat';

/** Stable reason labels used by the report picker and its accessibility names. */
export const MODERATION_REASON_LABELS = {
  HARASSMENT: 'Harassment or bullying',
  HATE: 'Hate or hateful conduct',
  SEXUAL_CONTENT: 'Sexual content',
  VIOLENCE_OR_THREATS: 'Threats or violence',
  SPAM: 'Spam or scam',
  OTHER: 'Something else',
} as const;

/** Reasons in the exact order required by the moderation UI. */
export const MODERATION_REASONS: ReadonlyArray<{
  value: ModerationReportReason;
  label: string;
}> = [
  { value: 'HARASSMENT', label: MODERATION_REASON_LABELS.HARASSMENT },
  { value: 'HATE', label: MODERATION_REASON_LABELS.HATE },
  { value: 'SEXUAL_CONTENT', label: MODERATION_REASON_LABELS.SEXUAL_CONTENT },
  { value: 'VIOLENCE_OR_THREATS', label: MODERATION_REASON_LABELS.VIOLENCE_OR_THREATS },
  { value: 'SPAM', label: MODERATION_REASON_LABELS.SPAM },
  { value: 'OTHER', label: MODERATION_REASON_LABELS.OTHER },
];

const optimisticBlockedUserCounts = new Map<string, number>();
const optimisticUnblockedUserCounts = new Map<string, number>();

/** Adds a User to the in-memory optimistic block set while a request is pending. */
export function addOptimisticBlockedUser(userId: string): void {
  const count: number = optimisticBlockedUserCounts.get(userId) ?? 0;
  optimisticBlockedUserCounts.set(userId, count + 1);
}

/** Removes a User from the in-memory optimistic block set. */
export function removeOptimisticBlockedUser(userId: string): void {
  const count: number = optimisticBlockedUserCounts.get(userId) ?? 0;
  if (count <= 1) {
    optimisticBlockedUserCounts.delete(userId);
    return;
  }
  optimisticBlockedUserCounts.set(userId, count - 1);
}

/** Marks a User as optimistically unblocked until the server mutation settles. */
export function addOptimisticUnblockedUser(userId: string): void {
  const count: number = optimisticUnblockedUserCounts.get(userId) ?? 0;
  optimisticUnblockedUserCounts.set(userId, count + 1);
}

/** Removes one pending optimistic unblock for a User. */
export function removeOptimisticUnblockedUser(userId: string): void {
  const count: number = optimisticUnblockedUserCounts.get(userId) ?? 0;
  if (count <= 1) {
    optimisticUnblockedUserCounts.delete(userId);
    return;
  }
  optimisticUnblockedUserCounts.set(userId, count - 1);
}

/**
 * Checks both the authoritative blocked-user cache and an in-flight optimistic block.
 *
 * @param queryClient - Query client owning moderation server state
 * @param userId - Sender identifier to check
 * @returns Whether the sender must currently be filtered
 */
export function isUserBlocked(queryClient: QueryClient, userId: string): boolean {
  if ((optimisticBlockedUserCounts.get(userId) ?? 0) > 0) return true;
  if ((optimisticUnblockedUserCounts.get(userId) ?? 0) > 0) return false;
  const data: InfiniteData<BlockedUsersPage, string | undefined> | undefined = queryClient.getQueryData(
    moderationQueryKeys.blocks(),
  );
  return (
    data?.pages.some((page: BlockedUsersPage): boolean =>
      page.items.some((blocked: { userId: string }): boolean => blocked.userId === userId),
    ) ?? false
  );
}

/** Error codes that have a moderation-specific, non-disclosing user message. */
export const MODERATION_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  INVALID_REPORT_TARGET: 'This message is no longer available.',
  REPORT_SCOPE_FORBIDDEN: 'Report unavailable.',
  SOCIAL_TARGET_UNAVAILABLE: 'Unable to complete this action.',
  REPORT_NOT_FOUND: 'Report status could not be confirmed. Try again.',
  SOCIAL_STATE_CHANGED: 'Block status changed. Refresh and try again.',
  REPORT_ALREADY_CLOSED: 'Report cannot be changed.',
};

/**
 * Maps a normalized moderation error without exposing server-owned report scope.
 *
 * @param error - Error returned by the Axios normalizer
 * @param fallback - Safe copy for unknown errors
 * @returns User-facing copy suitable for a moderation action surface
 */
export function getModerationErrorMessage(error: Error | null | undefined, fallback: string): string {
  if (!error) return fallback;
  const normalized: ChatNormalizedError = error as ChatNormalizedError;
  return (normalized.errorCode && MODERATION_ERROR_MESSAGES[normalized.errorCode]) || error.message || fallback;
}
