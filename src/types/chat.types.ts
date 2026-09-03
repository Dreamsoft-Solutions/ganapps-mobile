import type { GanapStatus } from './ganap.types';

/** Message variants returned by the Event Chat summary projection. */
export type ChatSummaryMessageType = 'TEXT' | 'IMAGE' | 'UNSENT';

/** Event Chat messages currently supported by the mobile core slice. */
export type ChatMessageType = 'TEXT';

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
  content: string;
  type: ChatMessageType;
  sentAt: string;
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
