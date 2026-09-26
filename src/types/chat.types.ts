import type { GanapStatus } from './ganap.types';

/** Message variants returned by the Event Chat summary projection. */
export type ChatSummaryMessageType = 'TEXT' | 'IMAGE' | 'UNSENT';

/** Message types whose moderation affordance is available on the message surface. */
export type ChatMessageType = 'TEXT' | 'IMAGE' | 'UNSENT';

/** Closed wire values for message and announcement reactions. */
export type ReactionType = 'HEART' | 'LAUGH' | 'THUMBS_UP' | 'SAD' | 'ANGRY';

/** One server-owned count in a reaction aggregate. */
export interface ReactionCount {
  type: ReactionType;
  count: number;
}

/** Counts and the current User's reaction returned by mutation endpoints. */
export interface ReactionAggregate {
  counts: ReactionCount[];
  myReaction: ReactionType | null;
}

/** Counts plus the current User's reaction for one target. */
export interface ReactionSummary extends ReactionAggregate {
  total: number;
}

/** MIME types accepted by the DS-97 chat-image pipeline. */
export type ChatImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

/** Canonical private-media projection returned with an image message. */
export interface ChatMessageMedia {
  id: string;
  url: string;
  mimeType: 'image/webp';
  bytes: number;
  width: number;
  height: number;
}

/** Local library asset retained while an image message is being sent or retried. */
export interface ChatImageAsset {
  uri: string;
  name: string;
  mimeType: string;
  fileSize?: number;
  width: number;
  height: number;
}

/** Explicit in-memory image draft states; no state is persisted to SQLite or storage. */
export type ChatImageDraftStatus = 'ready' | 'checking' | 'retryable-failure' | 'permanent-failure';

/** Image draft owned by the focused Event Chat composer. */
export interface ChatImageDraft {
  clientMessageId: string;
  asset: ChatImageAsset;
  status: ChatImageDraftStatus;
  error?: Error;
  retryAfterUntil?: number;
}

/** A server-owned latest-message projection used by the chat list. */
export interface EventChatLastMessage {
  id: string;
  type: ChatSummaryMessageType;
  preview: string;
  sentAt: string;
}

/** One readable Event Chat row returned by the server. */
export interface EventChatSummary {
  conversationId: string;
  type: 'EVENT';
  ganapId: string;
  title: string;
  lastMessage: EventChatLastMessage | null;
  unreadCount: number;
  canRead: boolean;
  canSend: boolean;
  updatedAt: string;
}

/** Safe friend projection embedded in a Direct Chat summary. */
export interface DirectChatFriendSummary {
  userId: string;
  username: string;
  displayName: string;
  displayPicture: string | null;
}

/** One server-owned Direct Chat summary used by the mixed Friends feed. */
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

/** Discriminated Event/Direct summary row returned by `type=ALL`. */
export type ChatConversationSummary = EventChatSummary | DirectChatSummary;

/** Session and capabilities resolved for the current User and Ganap. */
export interface EventChatSession {
  conversationId: string;
  ganapId: string;
  type: 'EVENT';
  capability: 'READ_ONLY' | 'READ_WRITE';
  canRead: boolean;
  canSend: boolean;
  isBusinessOnly: boolean;
  ganapStatus: Extract<GanapStatus, 'PUBLISHED' | 'ONGOING' | 'COMPLETED'>;
}

/** One canonical text message from the Event Chat API or socket. */
export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderUsername: string;
  senderDisplayPicture: string | null;
  content: string | null;
  type: ChatMessageType;
  /** Conversation discriminator included by shared chat socket payloads when available. */
  conversationType?: 'EVENT' | 'DIRECT';
  sentAt: string;
  media?: ChatMessageMedia | null;
  unsentAt?: string | null;
  reactionSummary?: ReactionSummary | null;
}

/** Cursor page returned by Event Chat history. */
export interface ChatMessagesPage {
  items: ChatMessage[];
  nextCursor: string | null;
}

/** Cursor page returned by the Event Chat summary endpoint. */
export interface EventChatSummaryPage {
  items: EventChatSummary[];
  nextCursor: string | null;
  /** Optional during the additive server rollout; present on current server responses. */
  hasUnreadMessages?: boolean;
}

/** Cursor page returned by the mixed Event/Direct summary endpoint. */
export interface ChatConversationSummaryPage {
  items: ChatConversationSummary[];
  nextCursor: string | null;
  /** Optional during the additive server rollout; present on current server responses. */
  hasUnreadMessages?: boolean;
}

/** Socket ticket used for authenticating the `/chat` namespace. */
export interface ChatSocketTicket {
  ticket: string;
  expiresIn: number;
}

/** Idempotent text-send request body. */
export interface SendChatMessageInput {
  clientMessageId: string;
  content: string;
}

/** Read-cursor request body. */
export interface MarkChatReadInput {
  throughMessageId: string;
}

/** Read-cursor response returned by the REST endpoint. */
export interface ChatReadResult {
  conversationId: string;
  throughMessageId: string;
  readAt: string;
  readCount: number;
}
