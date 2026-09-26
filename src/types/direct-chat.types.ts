import type { ChatMessage, ChatMessageMedia, EventChatLastMessage, EventChatSummary } from './chat.types';

/** Safe friend identity embedded in a Direct Chat summary or thread header. */
export interface DirectChatFriendSummary {
  userId: string;
  username: string;
  displayName: string;
  displayPicture: string | null;
}

/** Server-owned Direct summary returned by the unified conversation feed. */
export interface DirectChatSummary {
  conversationId: string;
  type: 'DIRECT';
  friend: DirectChatFriendSummary;
  lastMessage: EventChatLastMessage | null;
  unreadCount: number;
  latestOutgoingSeenAt: string | null;
  canRead: boolean;
  canSend: boolean;
  updatedAt: string;
}

/** Discriminated row returned by the `type=DIRECT` or `type=ALL` feed. */
export type DirectChatConversationSummary = DirectChatSummary;

/** Cursor page returned by the unified conversation summary endpoint. */
export interface DirectChatSummaryPage {
  items: DirectChatSummary[];
  nextCursor: string | null;
  /** Optional during the additive server rollout; present on current server responses. */
  hasUnreadMessages?: boolean;
}

/** Mixed Event/Direct summary row from the server-owned `type=ALL` feed. */
export type ChatConversationSummary = EventChatSummary | DirectChatSummary;

/** Cursor page returned by the server-owned mixed conversation feed. */
export interface ChatConversationSummaryPage {
  items: ChatConversationSummary[];
  nextCursor: string | null;
  /** Optional during the additive server rollout; present on current server responses. */
  hasUnreadMessages?: boolean;
}

/** Server-authoritative capabilities held by a selected Direct thread. */
export interface DirectChatSession {
  conversationId: string | null;
  friendUserId: string;
  friend: DirectChatFriendSummary | null;
  canRead: boolean;
  canSend: boolean;
}

/** Committed Direct read cursor returned by the server. */
export interface DirectChatReadResult {
  conversationId: string;
  throughMessageId: string;
  seenAt: string;
  readCount: number;
}

/** Type alias documenting the canonical Direct message response. */
export type DirectChatMessage = ChatMessage & {
  conversationType?: 'DIRECT';
  media?: ChatMessageMedia | null;
};
