import type { ChatMessage } from '@/types/chat.types';

const CHAT_MESSAGE_DATE_GROUP_GAP_MS: number = 12 * 60 * 60 * 1_000;

/**
 * Returns the local date label for the start of a visible message group.
 *
 * Chat history is newest-first for an inverted list, so `olderMessage` is the
 * next item in the loaded array. A new group starts at a local calendar-day
 * boundary or after a 12-hour gap within the same day. The oldest loaded item
 * is labeled until pagination reveals whether an earlier message belongs to it.
 *
 * @param message - The newer message whose group starts at this point
 * @param olderMessage - The next older loaded message, if any
 * @returns A device-local date label when the message starts a group, or null
 */
export function getChatMessageDateSeparatorLabel(
  message: ChatMessage,
  olderMessage: ChatMessage | undefined,
): string | null {
  const messageDate: Date = new Date(message.sentAt);
  const messageTimestamp: number = messageDate.getTime();
  if (Number.isNaN(messageTimestamp)) return null;

  if (olderMessage) {
    const olderDate: Date = new Date(olderMessage.sentAt);
    const olderTimestamp: number = olderDate.getTime();
    if (!Number.isNaN(olderTimestamp)) {
      const isSameLocalDay: boolean =
        messageDate.getFullYear() === olderDate.getFullYear() &&
        messageDate.getMonth() === olderDate.getMonth() &&
        messageDate.getDate() === olderDate.getDate();
      const elapsedMilliseconds: number = Math.abs(messageTimestamp - olderTimestamp);
      if (isSameLocalDay && elapsedMilliseconds < CHAT_MESSAGE_DATE_GROUP_GAP_MS) return null;
    }
  }

  return messageDate.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
