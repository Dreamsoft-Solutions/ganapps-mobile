import type {
  ChatConversationSummaryPage,
  ChatImageAsset,
  ChatMessage,
  ChatMessagesPage,
  ChatReadResult,
  ChatSocketTicket,
  EventChatSession,
  EventChatSummaryPage,
  MarkChatReadInput,
  SendChatMessageInput,
} from '@/types/chat.types';
import type { DirectChatReadResult } from '@/types/direct-chat.types';
import axiosInstance from '../axios-instance';

/** Query parameters accepted by the Event Chat summary endpoint. */
export interface EventChatListParams {
  type?: 'EVENT';
  cursor?: string;
  limit?: number;
}

/** Query parameters accepted by the mixed Event/Direct summary endpoint. */
export interface ChatConversationListParams {
  type?: 'EVENT' | 'DIRECT' | 'ALL';
  cursor?: string;
  limit?: number;
}

/** Query parameters accepted by the Event Chat history endpoint. */
export interface ChatMessagesParams {
  cursor?: string;
  limit?: number;
}

/** Multipart image fields sent to the Event Chat image endpoint. */
export interface SendChatImageInput {
  clientMessageId: string;
  file: Pick<ChatImageAsset, 'uri' | 'name' | 'mimeType'>;
}

/** Multipart Direct Chat image fields, shared by first and later sends. */
export type SendDirectChatImageInput = SendChatImageInput;

const CHAT_IMAGE_REQUEST_TIMEOUT_MS: number = 60_000;

function createChatImageFormData(input: SendChatImageInput): FormData {
  const formData: FormData = new FormData();
  formData.append('clientMessageId', input.clientMessageId);
  formData.append('file', {
    uri: input.file.uri,
    name: input.file.name,
    type: input.file.mimeType,
  } as unknown as Blob);
  return formData;
}

function imageRequestConfig(): {
  headers: { 'Content-Type': undefined };
  timeout: number;
  transformRequest: [(data: unknown) => unknown];
} {
  return {
    headers: { 'Content-Type': undefined },
    timeout: CHAT_IMAGE_REQUEST_TIMEOUT_MS,
    transformRequest: [(data: unknown): unknown => data],
  };
}

/** Typed Event Chat HTTP endpoints. Paths intentionally omit `/api/v1`. */
export const chatAPI = {
  /**
   * Requests a short-lived ticket for the process-wide Socket.IO client.
   *
   * @returns Ticket and its server-defined lifetime
   */
  getSocketTicket: (): Promise<ChatSocketTicket> =>
    axiosInstance.post<ChatSocketTicket>('/chat/socket-ticket').then((res) => res.data),

  /** Alias for callers that use the server operation's verb. */
  issueSocketTicket: (): Promise<ChatSocketTicket> => chatAPI.getSocketTicket(),

  /**
   * Lists readable Event Chat summaries in server order.
   *
   * @param params - Event type, opaque cursor, and page size
   * @returns Cursor page of server-owned summaries
   */
  listConversations: (params: EventChatListParams = { type: 'EVENT' }): Promise<EventChatSummaryPage> =>
    axiosInstance
      .get<EventChatSummaryPage>('/chat/conversations', {
        params: { type: 'EVENT', ...params },
      })
      .then((res) => res.data),

  /** Alias for the Event-only summary list. */
  getConversations: (params: EventChatListParams = { type: 'EVENT' }): Promise<EventChatSummaryPage> =>
    chatAPI.listConversations(params),

  /**
   * Lists the server-owned mixed Event and Direct summary feed for the Friends hub.
   *
   * @param params - Opaque cursor and bounded page size; the type is always `ALL`
   * @returns Cursor page preserving server ordering and capabilities
   */
  listAllConversations: (params: Omit<ChatConversationListParams, 'type'> = {}): Promise<ChatConversationSummaryPage> =>
    axiosInstance
      .get<ChatConversationSummaryPage>('/chat/conversations', {
        params: { type: 'ALL', cursor: params.cursor, limit: params.limit },
      })
      .then((res) => res.data),

  /** Alias for the Friends hub's mixed Event/Direct summary list. */
  listConversationSummaries: (
    params: Omit<ChatConversationListParams, 'type'> = {},
  ): Promise<ChatConversationSummaryPage> => chatAPI.listAllConversations(params),

  /**
   * Resolves one Ganap's Event Chat session and current capabilities.
   *
   * @param ganapId - Ganap whose Event Chat is requested
   * @returns Server-authoritative session and capability flags
   */
  resolveSession: (ganapId: string): Promise<EventChatSession> =>
    axiosInstance.post<EventChatSession>(`/ganaps/${ganapId}/chat`).then((res) => res.data),

  /** Alias for resolving the server-authoritative Event Chat session. */
  getSession: (ganapId: string): Promise<EventChatSession> => chatAPI.resolveSession(ganapId),

  /**
   * Reads one cursor page of newest-first Event Chat history.
   *
   * @param ganapId - Ganap whose messages are requested
   * @param params - Opaque cursor and page size
   * @returns Cursor page preserving the server's newest-first order
   */
  listMessages: (ganapId: string, params: ChatMessagesParams = {}): Promise<ChatMessagesPage> =>
    axiosInstance
      .get<ChatMessagesPage>(`/ganaps/${ganapId}/chat/messages`, {
        params: { cursor: params.cursor, limit: params.limit },
      })
      .then((res) => res.data),

  /** Alias for reading Event Chat history. */
  getMessages: (ganapId: string, params: ChatMessagesParams = {}): Promise<ChatMessagesPage> =>
    chatAPI.listMessages(ganapId, params),

  /**
   * Sends one text message through the Ganap-scoped REST endpoint.
   *
   * @param ganapId - Ganap whose Event Chat receives the message
   * @param input - Stable client id and message content
   * @returns Canonical persisted message
   */
  sendMessage: (ganapId: string, input: SendChatMessageInput): Promise<ChatMessage> =>
    axiosInstance.post<ChatMessage>(`/ganaps/${ganapId}/chat/messages`, input).then((res) => res.data),

  /**
   * Sends one existing-library image as a multipart Event Chat message.
   *
   * The native FormData request deliberately leaves the content type unset so
   * Axios/native networking can provide the multipart boundary.
   *
   * @param ganapId - Ganap whose Event Chat receives the image
   * @param input - Stable client id and one local image file
   * @returns Canonical persisted image message
   */
  sendImage: (ganapId: string, input: SendChatImageInput): Promise<ChatMessage> => {
    const formData: FormData = createChatImageFormData(input);
    return axiosInstance
      .post<ChatMessage>(`/ganaps/${ganapId}/chat/messages`, formData, {
        ...imageRequestConfig(),
      })
      .then((res) => res.data);
  },

  /**
   * Lists only server-owned Direct Chat summaries.
   *
   * @param params - Opaque cursor and bounded page size
   * @returns Cursor page preserving server order and capabilities
   */
  listDirectConversations: (
    params: Omit<ChatConversationListParams, 'type'> = {},
  ): Promise<ChatConversationSummaryPage> =>
    axiosInstance
      .get<ChatConversationSummaryPage>('/chat/conversations', {
        params: { type: 'DIRECT', cursor: params.cursor, limit: params.limit },
      })
      .then((res) => res.data),

  /**
   * Reads one cursor page of retained Direct Chat history.
   *
   * @param conversationId - Canonical Direct conversation id
   * @param params - Opaque cursor and bounded page size
   * @returns Newest-first Direct history page
   */
  listDirectMessages: (conversationId: string, params: ChatMessagesParams = {}): Promise<ChatMessagesPage> =>
    axiosInstance
      .get<ChatMessagesPage>(`/direct/conversations/${conversationId}/messages`, {
        params: { cursor: params.cursor, limit: params.limit },
      })
      .then((res) => res.data),

  /**
   * Sends the first Direct text message and lets the server create the canonical conversation.
   *
   * @param friendUserId - Accepted friend target
   * @param input - Stable client id and message content
   * @returns Canonical persisted Direct message
   */
  sendDirectMessageByFriend: (friendUserId: string, input: SendChatMessageInput): Promise<ChatMessage> =>
    axiosInstance.post<ChatMessage>(`/friends/${friendUserId}/direct/messages`, input).then((res) => res.data),

  /**
   * Sends a Direct text message in an existing canonical conversation.
   *
   * @param conversationId - Canonical Direct conversation id
   * @param input - Stable client id and message content
   * @returns Canonical persisted Direct message
   */
  sendDirectMessage: (conversationId: string, input: SendChatMessageInput): Promise<ChatMessage> =>
    axiosInstance.post<ChatMessage>(`/direct/conversations/${conversationId}/messages`, input).then((res) => res.data),

  /**
   * Sends the first Direct image through the accepted-friend route.
   *
   * @param friendUserId - Accepted friend target
   * @param input - Stable client id and one local image file
   * @returns Canonical persisted Direct image message
   */
  sendDirectImageByFriend: (friendUserId: string, input: SendDirectChatImageInput): Promise<ChatMessage> =>
    axiosInstance
      .post<ChatMessage>(
        `/friends/${friendUserId}/direct/messages`,
        createChatImageFormData(input),
        imageRequestConfig(),
      )
      .then((res) => res.data),

  /**
   * Sends a Direct image through an existing canonical conversation route.
   *
   * @param conversationId - Canonical Direct conversation id
   * @param input - Stable client id and one local image file
   * @returns Canonical persisted Direct image message
   */
  sendDirectImage: (conversationId: string, input: SendDirectChatImageInput): Promise<ChatMessage> =>
    axiosInstance
      .post<ChatMessage>(
        `/direct/conversations/${conversationId}/messages`,
        createChatImageFormData(input),
        imageRequestConfig(),
      )
      .then((res) => res.data),

  /**
   * Advances the Direct Seen cursor through one loaded message.
   *
   * @param conversationId - Canonical Direct conversation id
   * @param input - Greatest loaded message to mark read through
   * @returns Server-committed monotonic Seen cursor
   */
  markDirectRead: (conversationId: string, input: MarkChatReadInput): Promise<DirectChatReadResult> =>
    axiosInstance
      .post<DirectChatReadResult>(`/direct/conversations/${conversationId}/read`, input)
      .then((res) => res.data),

  /**
   * Advances the current User's read cursor through one loaded message.
   *
   * @param ganapId - Ganap whose Event Chat is marked read
   * @param input - Greatest loaded message to mark read through
   * @returns Server read receipt summary
   */
  markRead: (ganapId: string, input: MarkChatReadInput): Promise<ChatReadResult> =>
    axiosInstance.post<ChatReadResult>(`/ganaps/${ganapId}/chat/read`, input).then((res) => res.data),

  /** Alias for marking the current User's Event Chat cursor read. */
  markMessagesRead: (ganapId: string, input: MarkChatReadInput): Promise<ChatReadResult> =>
    chatAPI.markRead(ganapId, input),
};

/** Backwards-readable alias for callers that name the ticket operation explicitly. */
export const issueSocketTicket: typeof chatAPI.getSocketTicket = chatAPI.getSocketTicket;
