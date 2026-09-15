import type { InfiniteData } from '@tanstack/react-query';
import type { UnsentMessageResponse } from '@/api/endpoints/chat-engagement';
import type { PaginatedResponse } from '@/api/types/api-response';
import { ErrorMessages } from '@/constants/errors';
import type { ChatMessage, ChatMessagesPage, ReactionSummary, ReactionType } from '@/types/chat.types';
import type { GanapAnnouncement } from '@/types/ganap.types';

/** Server-enforced window in which a sender may unsend a chat message. */
export const CHAT_UNSEND_WINDOW_MS: number = 15 * 60 * 1_000;

/**
 * Checks whether the message should expose the sender-owned unsend action.
 *
 * The server remains authoritative; this guard only prevents presenting an
 * action that is already guaranteed to fail. Invalid and future timestamps
 * are treated as ineligible rather than risking a stale affordance.
 */
export function isChatMessageUnsendEligible(
  message: ChatMessage,
  currentUserId: string | null,
  now: number = Date.now(),
): boolean {
  if (message.type === 'UNSENT' || message.senderId !== currentUserId) return false;
  const sentAt: number = Date.parse(message.sentAt);
  if (!Number.isFinite(sentAt)) return false;
  const ageMs: number = now - sentAt;
  return ageMs >= 0 && ageMs <= CHAT_UNSEND_WINDOW_MS;
}

/**
 * Checks the presentation eligibility together with the current chat send capability.
 *
 * A read-only session may contain messages owned by the current User, but it
 * must not expose or submit sender actions from that session.
 */
export function isChatMessageUnsendAvailable(
  message: ChatMessage,
  currentUserId: string | null,
  canSend: boolean,
  now: number = Date.now(),
): boolean {
  return canSend && isChatMessageUnsendEligible(message, currentUserId, now);
}

/** The only reaction values exposed by the mobile engagement surface. */
export const CHAT_REACTION_OPTIONS: readonly {
  value: ReactionType;
  glyph: string;
  unselectedLabel: string;
  selectedLabel: string;
}[] = [
  { value: 'HEART', glyph: '❤️', unselectedLabel: 'React with heart', selectedLabel: 'Remove heart reaction' },
  {
    value: 'LAUGH',
    glyph: '😂',
    unselectedLabel: 'React with laughing face',
    selectedLabel: 'Remove laughing face reaction',
  },
  {
    value: 'THUMBS_UP',
    glyph: '👍',
    unselectedLabel: 'React with thumbs up',
    selectedLabel: 'Remove thumbs up reaction',
  },
  { value: 'SAD', glyph: '😢', unselectedLabel: 'React with sad face', selectedLabel: 'Remove sad face reaction' },
  { value: 'ANGRY', glyph: '😡', unselectedLabel: 'React with angry face', selectedLabel: 'Remove angry reaction' },
] as const;

/** Returns the exact accessibility copy required for one reaction control. */
export function getReactionAccessibilityLabel(reaction: ReactionType, selected: boolean): string {
  const option = CHAT_REACTION_OPTIONS.find((candidate) => candidate.value === reaction);
  return selected ? (option?.selectedLabel ?? 'Remove reaction') : (option?.unselectedLabel ?? 'React');
}

/**
 * Maps a typed engagement failure to safe copy for an inline toast.
 *
 * @param error - Rejection returned by an engagement endpoint or transport
 * @param fallback - Copy used when the rejection has no useful message
 * @returns User-facing engagement error copy
 */
export function getChatEngagementErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const candidate: { errorCode?: unknown } = error as Error & { errorCode?: unknown };
  const mapped: string | undefined =
    typeof candidate.errorCode === 'string' ? ErrorMessages[candidate.errorCode] : undefined;
  return mapped ?? (error.message || fallback);
}

/** Patches one message in a cursor-page cache without changing server order. */
export function patchMessageInPages(
  data: InfiniteData<ChatMessagesPage, string | undefined> | undefined,
  conversationId: string,
  messageId: string,
  patch: (message: ChatMessage) => ChatMessage,
): InfiniteData<ChatMessagesPage, string | undefined> | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map(
      (page: ChatMessagesPage): ChatMessagesPage => ({
        ...page,
        items: page.items.map(
          (message: ChatMessage): ChatMessage =>
            message.conversationId === conversationId && message.id === messageId ? patch(message) : message,
        ),
      }),
    ),
  };
}

/** Replaces a message with the public UNSENT tombstone and removes private state. */
export function replaceMessageWithUnsent(
  data: InfiniteData<ChatMessagesPage, string | undefined> | undefined,
  tombstone: UnsentMessageResponse,
): InfiniteData<ChatMessagesPage, string | undefined> | undefined {
  return patchMessageInPages(
    data,
    tombstone.conversationId,
    tombstone.id,
    (message: ChatMessage): ChatMessage => ({
      ...message,
      id: tombstone.id,
      conversationId: tombstone.conversationId,
      senderId: tombstone.senderId,
      senderUsername: tombstone.senderUsername,
      senderDisplayPicture: tombstone.senderDisplayPicture,
      type: 'UNSENT',
      content: null,
      media: null,
      unsentAt: tombstone.unsentAt,
      reactionSummary: null,
    }),
  );
}

/** Applies a socket tombstone while retaining the existing sender projection. */
export function markMessageUnsent(
  data: InfiniteData<ChatMessagesPage, string | undefined> | undefined,
  event: { conversationId: string; messageId: string; unsentAt: string },
): InfiniteData<ChatMessagesPage, string | undefined> | undefined {
  return patchMessageInPages(
    data,
    event.conversationId,
    event.messageId,
    (message: ChatMessage): ChatMessage => ({
      ...message,
      type: 'UNSENT',
      content: null,
      media: null,
      unsentAt: event.unsentAt,
      reactionSummary: null,
    }),
  );
}

/** Updates one announcement's acknowledgement aggregate in an offset-page cache. */
export function patchAnnouncementPages(
  data: InfiniteData<PaginatedResponse<GanapAnnouncement>, number> | undefined,
  announcementId: string,
  reactionSummary: ReactionSummary,
): InfiniteData<PaginatedResponse<GanapAnnouncement>, number> | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map(
      (page: PaginatedResponse<GanapAnnouncement>): PaginatedResponse<GanapAnnouncement> => ({
        ...page,
        items: page.items.map(
          (announcement: GanapAnnouncement): GanapAnnouncement =>
            announcement.id === announcementId ? { ...announcement, reactionSummary } : announcement,
        ),
      }),
    ),
  };
}
