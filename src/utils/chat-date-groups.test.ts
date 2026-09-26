import { describe, expect, it } from '@jest/globals';
import type { ChatMessage } from '@/types/chat.types';
import { getChatMessageDateSeparatorLabel } from './chat-date-groups';

function localTimestamp(year: number, month: number, day: number, hour: number, minute: number): string {
  return new Date(year, month - 1, day, hour, minute).toISOString();
}

function makeMessage(id: string, sentAt: string): ChatMessage {
  return {
    id,
    conversationId: 'conversation-1',
    senderId: 'user-1',
    senderUsername: 'user',
    senderDisplayPicture: null,
    content: id,
    type: 'TEXT',
    sentAt,
  };
}

function dateLabel(sentAt: string): string {
  return new Date(sentAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

describe('getChatMessageDateSeparatorLabel', (): void => {
  it('keeps same-day messages together when the gap is under 12 hours', (): void => {
    const newer = makeMessage('newer', localTimestamp(2026, 9, 1, 22, 0));
    const older = makeMessage('older', localTimestamp(2026, 9, 1, 10, 1));

    expect(getChatMessageDateSeparatorLabel(newer, older)).toBeNull();
  });

  it('starts a new group when the same-day gap is exactly 12 hours', (): void => {
    const newerAt = localTimestamp(2026, 9, 1, 22, 0);
    const newer = makeMessage('newer', newerAt);
    const older = makeMessage('older', localTimestamp(2026, 9, 1, 10, 0));

    expect(getChatMessageDateSeparatorLabel(newer, older)).toBe(dateLabel(newerAt));
  });

  it('starts a new group when the local calendar date changes before 12 hours pass', (): void => {
    const newerAt = localTimestamp(2026, 9, 2, 0, 30);
    const newer = makeMessage('newer', newerAt);
    const older = makeMessage('older', localTimestamp(2026, 9, 1, 23, 30));

    expect(getChatMessageDateSeparatorLabel(newer, older)).toBe(dateLabel(newerAt));
  });

  it('labels the oldest loaded message while an older page is not loaded yet', (): void => {
    const oldestLoaded = makeMessage('oldest-loaded', localTimestamp(2026, 8, 31, 22, 0));

    expect(getChatMessageDateSeparatorLabel(oldestLoaded, undefined)).toBe(dateLabel(oldestLoaded.sentAt));
  });
});
