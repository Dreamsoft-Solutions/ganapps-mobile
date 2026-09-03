import { io } from 'socket.io-client';
import { API_BASE_URL } from '@/api/config';
import { chatAPI } from '@/api/endpoints/chat';
import { useAuthStore } from '@/store/auth.store';
import type { ChatMessage, ChatReadResult } from '@/types/chat.types';

/** Connection states exposed to Event Chat screens. */
export type ChatConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';

/** Read event shape emitted by the `/chat` namespace. */
export interface ChatSocketReadReceipt {
  conversationId: string;
  throughMessageId: string;
  userId: string;
  readAt: string;
}

/** Events delivered to one conversation listener. */
export type ChatSocketEvent =
  | { type: 'message'; message: ChatMessage }
  | { type: 'read'; receipt: ChatSocketReadReceipt };

/** Listener invoked for canonical Event Chat socket events. */
export type ChatSocketListener = (event: ChatSocketEvent) => void;

interface RoomSubscription {
  ganapId: string;
  listeners: Set<ChatSocketListener>;
}

interface TicketCache {
  ticket: string;
  expiresAt: number;
}

export interface ChatSocketLike {
  auth: unknown;
  connected: boolean;
  connect: () => void;
  disconnect: (close?: boolean) => void;
  emit: (...args: unknown[]) => boolean;
  on: (event: string, listener: (...args: unknown[]) => void) => ChatSocketLike;
  off: (event: string, listener?: (...args: unknown[]) => void) => ChatSocketLike;
  removeAllListeners: () => ChatSocketLike;
}

/** Factory signature exposed for deterministic lifecycle tests. */
export type ChatSocketFactory = (
  url: string,
  options: { autoConnect: false; transports: ['websocket']; reconnection: false },
) => ChatSocketLike;

const INITIAL_RECONNECT_DELAY_MS = 500;
const MAX_RECONNECT_DELAY_MS = 10_000;
const MAX_SEEN_MESSAGE_IDS = 5_000;

/**
 * Builds the namespace URL from the same origin as the REST API.
 *
 * The API base already contains `/api/v1`; Socket.IO's namespace is rooted at
 * `/chat`, not under the REST prefix.
 *
 * @param apiBaseUrl - REST base URL
 * @returns Namespace URL without credentials
 */
export function buildChatSocketUrl(apiBaseUrl: string = API_BASE_URL): string {
  const origin: string = apiBaseUrl.replace(/\/api(?:\/v\d+)?\/?$/, '').replace(/\/$/, '');
  return `${origin}/chat`;
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<ChatMessage>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.conversationId === 'string' &&
    typeof candidate.senderId === 'string' &&
    typeof candidate.senderUsername === 'string' &&
    (typeof candidate.senderDisplayPicture === 'string' || candidate.senderDisplayPicture === null) &&
    typeof candidate.content === 'string' &&
    candidate.type === 'TEXT' &&
    typeof candidate.sentAt === 'string'
  );
}

function isReadReceipt(value: unknown): value is ChatSocketReadReceipt {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<ChatSocketReadReceipt>;
  return (
    typeof candidate.conversationId === 'string' &&
    typeof candidate.throughMessageId === 'string' &&
    typeof candidate.userId === 'string' &&
    typeof candidate.readAt === 'string'
  );
}

function isSocketAuthError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as { message?: unknown; data?: unknown; status?: unknown };
  const message: string = typeof candidate.message === 'string' ? candidate.message.toLowerCase() : '';
  return (
    candidate.status === 401 ||
    message.includes('unauthorized') ||
    message.includes('authentication') ||
    message.includes('ticket') ||
    (typeof candidate.data === 'object' &&
      candidate.data !== null &&
      'errorCode' in candidate.data &&
      candidate.data.errorCode === 'UNAUTHORIZED')
  );
}

/**
 * Owns the process-wide `/chat` Socket.IO connection and room subscriptions.
 *
 * REST remains the only mobile send/read transport. This client only joins
 * readable rooms and forwards committed server events to focused screens.
 */
export class ChatSocketClient {
  private readonly socketFactory: ChatSocketFactory;
  private socket: ChatSocketLike | null = null;
  private ticketCache: TicketCache | null = null;
  private readonly rooms = new Map<string, RoomSubscription>();
  private readonly stateListeners = new Set<(state: ChatConnectionState) => void>();
  private readonly seenMessageIds = new Set<string>();
  private connectionState: ChatConnectionState = 'idle';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private connectionPromise: Promise<void> | null = null;
  private intentionalDisconnect = false;

  /**
   * Creates a client. The factory is injectable to keep lifecycle tests fully
   * deterministic without constructing a native WebSocket.
   *
   * @param socketFactory - Optional Socket.IO factory
   */
  public constructor(
    socketFactory: ChatSocketFactory = (
      url: string,
      options: { autoConnect: false; transports: ['websocket']; reconnection: false },
    ): ChatSocketLike => io(url, options) as unknown as ChatSocketLike,
  ) {
    this.socketFactory = socketFactory;
  }

  /** Current connection state. */
  public getConnectionState(): ChatConnectionState {
    return this.connectionState;
  }

  /**
   * Subscribes to connection-state changes.
   *
   * @param listener - State listener
   * @returns Cleanup function
   */
  public onConnectionStateChange(listener: (state: ChatConnectionState) => void): () => void {
    this.stateListeners.add(listener);
    return (): void => {
      this.stateListeners.delete(listener);
    };
  }

  /**
   * Focuses a readable conversation and joins its server room once connected.
   *
   * @param conversationId - Conversation room key
   * @param ganapId - Ganap used by the server's `chat:join` command
   * @param listener - Screen listener
   * @returns Cleanup function that decrements the room reference count
   */
  public subscribe(conversationId: string, ganapId: string, listener: ChatSocketListener): () => void {
    if (!conversationId || !ganapId) return (): void => {};

    const existing: RoomSubscription | undefined = this.rooms.get(conversationId);
    const room: RoomSubscription = existing ?? { ganapId, listeners: new Set<ChatSocketListener>() };
    const hadListeners: boolean = room.listeners.size > 0;
    if (room.ganapId !== ganapId) room.ganapId = ganapId;
    room.listeners.add(listener);
    this.rooms.set(conversationId, room);

    if (this.socket?.connected && !hadListeners) this.joinRoom(conversationId, room.ganapId);
    else void this.ensureConnected();

    let active = true;
    return (): void => {
      if (!active) return;
      active = false;
      const current: RoomSubscription | undefined = this.rooms.get(conversationId);
      if (!current) return;
      current.listeners.delete(listener);
      if (current.listeners.size > 0) return;
      if (this.socket?.connected) this.socket.emit('chat:leave', { conversationId });
      this.rooms.delete(conversationId);
      if (this.rooms.size === 0) this.disconnect('no-subscribers');
    };
  }

  /**
   * Disconnects and removes every listener/room, used on logout, token loss,
   * account deletion, and test teardown.
   *
   * @returns Nothing
   */
  public teardown(): void {
    this.rooms.clear();
    this.cancelReconnect();
    this.ticketCache = null;
    this.reconnectAttempt = 0;
    this.intentionalDisconnect = true;
    this.socket?.removeAllListeners();
    this.socket?.disconnect(true);
    this.socket = null;
    this.connectionPromise = null;
    this.seenMessageIds.clear();
    this.setConnectionState('idle');
    this.intentionalDisconnect = false;
  }

  /** Clears the cached ticket without dropping focused room subscriptions. */
  public invalidateTicket(): void {
    this.ticketCache = null;
  }

  private async ensureConnected(): Promise<void> {
    if (!useAuthStore.getState().token || this.rooms.size === 0) return;
    if (this.socket?.connected || this.connectionPromise) return;

    this.connectionPromise = this.connect().finally((): void => {
      this.connectionPromise = null;
    });
    await this.connectionPromise;
  }

  private async connect(): Promise<void> {
    if (!useAuthStore.getState().token || this.rooms.size === 0) return;
    this.setConnectionState(this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting');

    try {
      const ticket: string = await this.getValidTicket();
      if (!useAuthStore.getState().token || this.rooms.size === 0) return;
      this.intentionalDisconnect = false;
      if (!this.socket) this.createSocket();
      if (!this.socket) return;
      this.socket.auth = { ticket };
      this.socket.connect();
    } catch (error) {
      if (isSocketAuthError(error)) this.invalidateTicket();
      this.setConnectionState('error');
      this.scheduleReconnect();
    }
  }

  private async getValidTicket(): Promise<string> {
    const now: number = Date.now();
    if (this.ticketCache && now < this.ticketCache.expiresAt) return this.ticketCache.ticket;
    const response: { ticket: string; expiresIn: number } = await chatAPI.getSocketTicket();
    const expiresInMs: number = Math.max(0, response.expiresIn * 1000);
    this.ticketCache = { ticket: response.ticket, expiresAt: now + expiresInMs };
    return response.ticket;
  }

  private createSocket(): void {
    const socket: ChatSocketLike = this.socketFactory(buildChatSocketUrl(), {
      autoConnect: false,
      transports: ['websocket'],
      reconnection: false,
    });
    this.socket = socket;
    socket.on('connect', this.handleConnect);
    socket.on('disconnect', this.handleDisconnect);
    socket.on('connect_error', this.handleConnectError);
    socket.on('chat:message:new', this.handleMessage);
    socket.on('chat:message:read', this.handleRead);
  }

  private readonly handleConnect = (): void => {
    this.reconnectAttempt = 0;
    this.cancelReconnect();
    this.setConnectionState('connected');
    this.rooms.forEach((_room: RoomSubscription, conversationId: string): void => {
      const room: RoomSubscription | undefined = this.rooms.get(conversationId);
      if (room) this.joinRoom(conversationId, room.ganapId);
    });
  };

  private readonly handleDisconnect = (): void => {
    if (this.intentionalDisconnect || this.rooms.size === 0 || !useAuthStore.getState().token) {
      this.setConnectionState('disconnected');
      return;
    }
    this.setConnectionState('reconnecting');
    this.scheduleReconnect();
  };

  private readonly handleConnectError = (error: unknown): void => {
    if (isSocketAuthError(error)) this.invalidateTicket();
    this.setConnectionState('error');
    if (!this.intentionalDisconnect) this.scheduleReconnect();
  };

  private readonly handleMessage = (value: unknown): void => {
    if (!isChatMessage(value)) return;
    const seenKey: string = `${value.conversationId}:${value.id}`;
    if (this.seenMessageIds.has(seenKey)) return;
    this.seenMessageIds.add(seenKey);
    if (this.seenMessageIds.size > MAX_SEEN_MESSAGE_IDS) {
      const oldest: string | undefined = this.seenMessageIds.values().next().value;
      if (oldest) this.seenMessageIds.delete(oldest);
    }
    const room: RoomSubscription | undefined = this.rooms.get(value.conversationId);
    room?.listeners.forEach((listener: ChatSocketListener): void => {
      listener({ type: 'message', message: value });
    });
  };

  private readonly handleRead = (value: unknown): void => {
    if (!isReadReceipt(value)) return;
    const room: RoomSubscription | undefined = this.rooms.get(value.conversationId);
    room?.listeners.forEach((listener: ChatSocketListener): void => {
      listener({ type: 'read', receipt: value });
    });
  };

  private joinRoom(conversationId: string, ganapId: string): void {
    this.socket?.emit('chat:join', { ganapId });
    // Keep the conversation id in this method's contract for room reference
    // accounting and future server acknowledgements without sending it in the
    // wire payload, whose DS-95 contract is Ganap-scoped.
    void conversationId;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.rooms.size === 0 || !useAuthStore.getState().token) return;
    const delay: number = Math.min(INITIAL_RECONNECT_DELAY_MS * 2 ** this.reconnectAttempt, MAX_RECONNECT_DELAY_MS);
    this.reconnectAttempt = Math.min(this.reconnectAttempt + 1, 8);
    this.reconnectTimer = setTimeout((): void => {
      this.reconnectTimer = null;
      void this.ensureConnected();
    }, delay);
  }

  private cancelReconnect(): void {
    if (!this.reconnectTimer) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private disconnect(_reason: string): void {
    this.cancelReconnect();
    this.intentionalDisconnect = true;
    this.socket?.disconnect(true);
    this.socket = null;
    this.ticketCache = null;
    this.reconnectAttempt = 0;
    this.setConnectionState('disconnected');
    this.intentionalDisconnect = false;
  }

  private setConnectionState(state: ChatConnectionState): void {
    if (this.connectionState === state) return;
    this.connectionState = state;
    this.stateListeners.forEach((listener: (next: ChatConnectionState) => void): void => {
      listener(state);
    });
  }
}

/** Singleton shared by every Event Chat screen in this process. */
export const chatSocketClient = new ChatSocketClient();

/** Alias retained for domain callers that prefer a service-shaped name. */
export const chatSocketService: ChatSocketClient = chatSocketClient;

// Token loss is the one lifecycle boundary that can happen outside a chat
// screen. Listening here guarantees logout/account deletion tears down rooms
// even if the route tree is still mounted for a render. Access-token rotation
// is deliberately left connected: refresh keeps the same authenticated user,
// and tearing down here would discard focused room subscriptions.
useAuthStore.subscribe((state, previous): void => {
  if (state.token === null && previous.token !== null) chatSocketClient.teardown();
});

/** Type-only reference keeps the read response contract discoverable to consumers. */
export type ChatSocketReadResponse = ChatReadResult;
