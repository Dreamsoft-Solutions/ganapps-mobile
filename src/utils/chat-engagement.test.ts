import { describe, expect, it } from '@jest/globals';
import type { ChatMessage } from '@/types/chat.types';
import {
  CHAT_UNSEND_WINDOW_MS,
  isChatMessageUnsendAvailable,
  isChatMessageUnsendEligible,
} from './chat-engagement';

const NOW: number = Date.parse('2026-09-07T12:00:00.000Z');

function messageAt(sentAt: number): ChatMessage {
  return {
    id: 'message-1',
    conversationId: 'conversation-1',
    senderId: 'current-user',
    senderUsername: 'current-user',
    senderDisplayPicture: null,
    content: 'A message I sent.',
    type: 'TEXT',
    sentAt: new Date(sentAt).toISOString(),
  };
}

describe('chat unsend eligibility', (): void => {
  it('accepts the exact 15-minute boundary but rejects expired and future messages', (): void => {
    expect(isChatMessageUnsendEligible(messageAt(NOW - CHAT_UNSEND_WINDOW_MS), 'current-user', NOW)).toBe(true);
    expect(isChatMessageUnsendEligible(messageAt(NOW - CHAT_UNSEND_WINDOW_MS - 1), 'current-user', NOW)).toBe(false);
    expect(isChatMessageUnsendEligible(messageAt(NOW + 1), 'current-user', NOW)).toBe(false);
  });

  it('does not expose an own-message unsend action from a read-only session', (): void => {
    const message: ChatMessage = messageAt(NOW - 1_000);
    expect(isChatMessageUnsendAvailable(message, 'current-user', false, NOW)).toBe(false);
    expect(isChatMessageUnsendAvailable(message, 'current-user', true, NOW)).toBe(true);
  });
});
