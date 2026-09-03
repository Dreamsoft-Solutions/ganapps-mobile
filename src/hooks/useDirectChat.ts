import { type InfiniteData, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BLOCKED_USERS_PAGE_SIZE, moderationAPI } from '@/api/endpoints/moderation';
import {
  type MarkDirectReadVariables,
  type SendDirectMessageByFriendVariables,
  type SendDirectMessageVariables,
  useMarkDirectReadMutation,
  useSendDirectImageByFriendMutation,
  useSendDirectImageMutation,
  useSendDirectMessageByFriendMutation,
  useSendDirectMessageMutation,
} from '@/hooks/mutations/useDirectChatMutation';
import { type ChatPageParam, chatQueryKeys, useDirectChatMessagesQuery } from '@/hooks/queries/useChatQuery';
import { type ModerationPageParam, moderationQueryKeys } from '@/hooks/queries/useModerationQuery';
import {
  type ChatConnectionState,
  type ChatSocketEvent,
  type ChatSocketModerationEvent,
  chatSocketClient,
} from '@/services/chat-socket.service';
import { useAuthStore } from '@/store/auth.store';
import type { ChatMessage, ChatMessagesPage } from '@/types/chat.types';
import type {
  ChatConversationSummary,
  ChatConversationSummaryPage,
  DirectChatFriendSummary,
  DirectChatReadResult,
  DirectChatSession,
} from '@/types/direct-chat.types';
import type { BlockedUsersPage } from '@/types/moderation.types';
import {
  compareChatMessages,
  compareChatMessagePositions,
  getChatMessagePreview,
  greatestChatMessage,
  isChatNetworkError,
  upsertChatMessage,
} from '@/utils/chat';
import {
  CHAT_IMAGE_PICKER_OPTIONS,
  getChatImageErrorCode,
  getChatImagePrecheckError,
  getChatImageRetryAfterSeconds,
  isRetryableChatImageError,
  toChatImageAsset,
} from '@/utils/chat-image';
import { isUserBlocked } from '@/utils/moderation';

/** A failed in-memory Direct send that can be retried with the same client id. */
export interface DirectFailedDraft {
  clientMessageId: string;
  content: string;
  error: Error;
  target: { type: 'friend'; id: string } | { type: 'conversation'; id: string };
}

/** Options for a selected Direct Chat, including server-owned capabilities. */
export interface UseDirectChatOptions {
  conversationId?: string;
  friendUserId?: string;
  friend?: DirectChatFriendSummary | null;
  canRead?: boolean;
  canSend?: boolean;
  latestOutgoingSeenAt?: string | null;
  enabled?: boolean;
  focused?: boolean;
}

/** Public aggregate returned by {@link useDirectChat}. */
export interface UseDirectChatResult {
  session: DirectChatSession | null;
  friend: DirectChatFriendSummary | null;
  conversationId: string | null;
  canRead: boolean;
  canSend: boolean;
  latestOutgoingSeenAt: string | null;
  messages: ChatMessage[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  loadMore: () => Promise<void>;
  fetchNextPage: () => Promise<void>;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  isSending: boolean;
  isMarkingRead: boolean;
  failedDrafts: DirectFailedDraft[];
  sendMessage: (content: string) => Promise<void>;
  send: (content: string) => Promise<void>;
  retryDraft: (clientMessageId: string) => Promise<void>;
  discardDraft: (clientMessageId: string) => void;
  imageDraft: import('@/types/chat.types').ChatImageDraft | null;
  imagePickerError: Error | null;
  imageRetryAfterSeconds: number | null;
  pickImage: () => Promise<void>;
  removeImage: () => void;
  sendImage: () => Promise<void>;
  retryImage: () => Promise<void>;
  refreshImage: (messageId: string) => Promise<void>;
  connectionState: ChatConnectionState;
  accessLost: boolean;
  accessRevoked: boolean;
  isReadOnly: boolean;
}

function createClientMessageId(): string {
  const cryptoObject: Crypto | undefined = typeof globalThis.crypto === 'object' ? globalThis.crypto : undefined;
  if (cryptoObject && typeof cryptoObject.randomUUID === 'function') return cryptoObject.randomUUID();
  return `mobile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`.slice(0, 100);
}

function normalizeCaughtError(error: unknown): Error {
  return error instanceof Error ? error : new Error('Image could not be sent.');
}

function canSubmitImageDraft(
  draft: import('@/types/chat.types').ChatImageDraft,
  canSend: boolean,
  accessLost: boolean,
  inFlightIds: Set<string>,
): boolean {
  return (
    canSend &&
    !accessLost &&
    draft.status !== 'checking' &&
    draft.status !== 'permanent-failure' &&
    !inFlightIds.has(draft.clientMessageId)
  );
}

function updateImageDraftAfterFailure(
  current: import('@/types/chat.types').ChatImageDraft | null,
  draft: import('@/types/chat.types').ChatImageDraft,
  error: Error,
): import('@/types/chat.types').ChatImageDraft | null {
  if (!current || current.clientMessageId !== draft.clientMessageId) return current;
  const retryable: boolean = isRetryableChatImageError(error);
  const retryAfterSeconds: number | null = retryable ? getChatImageRetryAfterSeconds(error) : null;
  return {
    ...current,
    status: retryable ? 'retryable-failure' : 'permanent-failure',
    error,
    retryAfterUntil: retryAfterSeconds ? Date.now() + retryAfterSeconds * 1000 : undefined,
  };
}

function upsertMessageInPages(
  data: InfiniteData<ChatMessagesPage, ChatPageParam> | undefined,
  message: ChatMessage,
): InfiniteData<ChatMessagesPage, ChatPageParam> | undefined {
  if (!data || data.pages.length === 0) return data;
  const [firstPage, ...remainingPages]: ChatMessagesPage[] = data.pages;
  return {
    ...data,
    pages: [
      { ...firstPage, items: upsertChatMessage(firstPage.items, message) },
      ...remainingPages.map(
        (page: ChatMessagesPage): ChatMessagesPage => ({
          ...page,
          items: page.items.filter((item: ChatMessage): boolean => item.id !== message.id),
        }),
      ),
    ],
  };
}

function removeMessageFromPages(
  data: InfiniteData<ChatMessagesPage, ChatPageParam> | undefined,
  messageId: string,
): InfiniteData<ChatMessagesPage, ChatPageParam> | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map(
      (page: ChatMessagesPage): ChatMessagesPage => ({
        ...page,
        items: page.items.filter((message: ChatMessage): boolean => message.id !== messageId),
      }),
    ),
  };
}

function patchSummaryForMessage(
  data: InfiniteData<ChatConversationSummaryPage, ChatPageParam> | undefined,
  message: ChatMessage,
  incrementUnread: boolean,
): InfiniteData<ChatConversationSummaryPage, ChatPageParam> | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map(
      (page: ChatConversationSummaryPage): ChatConversationSummaryPage => ({
        ...page,
        items: page.items.map((summary: ChatConversationSummary): ChatConversationSummary => {
          if (summary.type !== 'DIRECT' || summary.conversationId !== message.conversationId) return summary;
          if (summary.lastMessage && compareChatMessagePositions(message, summary.lastMessage) <= 0) return summary;
          return {
            ...summary,
            lastMessage: {
              id: message.id,
              type: message.type,
              preview: getChatMessagePreview(message),
              sentAt: message.sentAt,
            },
            unreadCount: incrementUnread ? summary.unreadCount + 1 : summary.unreadCount,
            updatedAt: message.sentAt,
          };
        }),
      }),
    ),
  };
}

function patchSummarySeenAt(
  data: InfiniteData<ChatConversationSummaryPage, ChatPageParam> | undefined,
  conversationId: string,
  seenAt: string,
): InfiniteData<ChatConversationSummaryPage, ChatPageParam> | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map(
      (page: ChatConversationSummaryPage): ChatConversationSummaryPage => ({
        ...page,
        items: page.items.map((summary: ChatConversationSummary): ChatConversationSummary => {
          if (summary.type !== 'DIRECT' || summary.conversationId !== conversationId) return summary;
          const previous: string | null = summary.latestOutgoingSeenAt;
          if (previous && new Date(previous).getTime() >= new Date(seenAt).getTime()) return summary;
          return { ...summary, latestOutgoingSeenAt: seenAt };
        }),
      }),
    ),
  };
}

function isMessageAtOrBefore(first: ChatMessage, second: ChatMessage): boolean {
  return compareChatMessages(first, second) <= 0;
}

function latestOutgoingMessage(messages: ChatMessage[], userId: string | null): ChatMessage | null {
  if (!userId) return null;
  return messages.reduce<ChatMessage | null>((latest, message): ChatMessage | null => {
    if (message.senderId !== userId) return latest;
    return latest === null || compareChatMessages(message, latest) > 0 ? message : latest;
  }, null);
}

function getSeenTimestamp(receipt: { seenAt?: string; readAt?: string }): string | null {
  return receipt.seenAt ?? receipt.readAt ?? null;
}

/**
 * Aggregates Direct history, lazy first-send creation, the shared socket, and
 * foreground-only Seen state for one selected Direct thread.
 *
 * The aggregate never creates a Direct summary row. A first-send response only
 * supplies the canonical conversation id; the server-owned summary query is
 * invalidated so the row appears on its next response.
 *
 * @param options - Selected conversation/friend, capabilities, and focus state
 * @returns Direct Chat state and actions
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Direct Chat owns explicit lazy-send, image, socket, access, and Seen transitions.
export function useDirectChat(options: UseDirectChatOptions = {}): UseDirectChatResult {
  const queryClient = useQueryClient();
  const currentUserId: string | null = useAuthStore((state) => state.user?.id ?? null);
  const enabled: boolean = options.enabled ?? true;
  const focused: boolean = options.focused ?? false;
  const [createdConversationId, setCreatedConversationId] = useState<string | null>(null);
  const [accessRevoked, setAccessRevoked] = useState<boolean>(false);
  const [latestOutgoingSeenAt, setLatestOutgoingSeenAt] = useState<string | null>(options.latestOutgoingSeenAt ?? null);
  const [failedDraftMap, setFailedDraftMap] = useState<Record<string, DirectFailedDraft>>({});
  const [imageDraft, setImageDraft] = useState<import('@/types/chat.types').ChatImageDraft | null>(null);
  const [imagePickerError, setImagePickerError] = useState<Error | null>(null);
  const [imageRetryClock, setImageRetryClock] = useState<number>(Date.now());
  const [connectionState, setConnectionState] = useState<ChatConnectionState>(chatSocketClient.getConnectionState());
  const inFlightIds = useRef<Set<string>>(new Set<string>());
  const inFlightImageIds = useRef<Set<string>>(new Set<string>());
  const readCursor = useRef<ChatMessage | null>(null);
  const pendingReadCursor = useRef<ChatMessage | null>(null);
  const previousTarget = useRef<string>(`${options.conversationId ?? ''}:${options.friendUserId ?? ''}`);
  const previousConnectionState = useRef<ChatConnectionState>(connectionState);

  const conversationId: string = options.conversationId ?? createdConversationId ?? '';
  const friendUserId: string = options.friendUserId ?? '';
  const canRead: boolean = options.canRead === true || createdConversationId !== null;
  const canSend: boolean = options.canSend === true || createdConversationId !== null;
  const accessLost: boolean = accessRevoked || (Boolean(conversationId) && !canRead);
  const messagesQuery = useDirectChatMessagesQuery(conversationId, enabled && canRead && !accessLost);
  const sendByFriendMutation = useSendDirectMessageByFriendMutation();
  const sendMutation = useSendDirectMessageMutation();
  const sendImageByFriendMutation = useSendDirectImageByFriendMutation();
  const sendImageMutation = useSendDirectImageMutation();
  const readMutation = useMarkDirectReadMutation();

  const refreshBlocksBeforeJoin = useCallback(async (): Promise<void> => {
    const page: BlockedUsersPage = await moderationAPI.listBlocks({ limit: BLOCKED_USERS_PAGE_SIZE });
    queryClient.setQueryData<InfiniteData<BlockedUsersPage, ModerationPageParam>>(
      moderationQueryKeys.blocks(),
      (): InfiniteData<BlockedUsersPage, ModerationPageParam> => ({
        pages: [page],
        pageParams: [undefined],
      }),
    );
  }, [queryClient]);

  useEffect((): (() => void) => chatSocketClient.setBeforeJoin(refreshBlocksBeforeJoin), [refreshBlocksBeforeJoin]);

  useEffect((): (() => void) | undefined => {
    const target: string = `${options.conversationId ?? ''}:${options.friendUserId ?? ''}`;
    if (target === previousTarget.current) return undefined;
    previousTarget.current = target;
    setCreatedConversationId(null);
    setAccessRevoked(false);
    setLatestOutgoingSeenAt(options.latestOutgoingSeenAt ?? null);
    setFailedDraftMap({});
    setImageDraft(null);
    setImagePickerError(null);
    readCursor.current = null;
    pendingReadCursor.current = null;
  }, [options.conversationId, options.friendUserId, options.latestOutgoingSeenAt]);

  useEffect((): void => {
    setLatestOutgoingSeenAt(options.latestOutgoingSeenAt ?? null);
  }, [options.latestOutgoingSeenAt]);

  useEffect((): (() => void) => {
    return chatSocketClient.onConnectionStateChange((nextState: ChatConnectionState): void => {
      setConnectionState(nextState);
    });
  }, []);

  const handleModerationEvent = useCallback(
    (moderationEvent: ChatSocketModerationEvent): void => {
      if (!conversationId || moderationEvent.event.conversationId !== conversationId) return;
      if (moderationEvent.type === 'message-hidden') {
        queryClient.setQueryData<InfiniteData<ChatMessagesPage, ChatPageParam>>(
          chatQueryKeys.directMessages(conversationId),
          (data: InfiniteData<ChatMessagesPage, ChatPageParam> | undefined) =>
            removeMessageFromPages(data, moderationEvent.event.messageId),
        );
        void queryClient.invalidateQueries({ queryKey: chatQueryKeys.directMessages(conversationId) });
        void queryClient.invalidateQueries({ queryKey: chatQueryKeys.directSummaries() });
        return;
      }
      setAccessRevoked(true);
      chatSocketClient.leaveConversation(conversationId);
      queryClient.removeQueries({ queryKey: chatQueryKeys.directMessages(conversationId), exact: true });
    },
    [conversationId, queryClient],
  );

  useEffect((): (() => void) => chatSocketClient.onModerationEvent(handleModerationEvent), [handleModerationEvent]);

  useEffect((): (() => void) | undefined => {
    if (!conversationId || !canRead || accessLost || !enabled) return undefined;
    const unsubscribe: () => void = chatSocketClient.subscribeDirect(conversationId, (event: ChatSocketEvent): void => {
      if (event.type === 'message') {
        const incoming: ChatMessage = event.message;
        if (incoming.conversationId !== conversationId || isUserBlocked(queryClient, incoming.senderId)) return;
        queryClient.setQueryData<InfiniteData<ChatMessagesPage, ChatPageParam>>(
          chatQueryKeys.directMessages(conversationId),
          (data: InfiniteData<ChatMessagesPage, ChatPageParam> | undefined) => upsertMessageInPages(data, incoming),
        );
        queryClient.setQueryData<InfiniteData<ChatConversationSummaryPage, ChatPageParam>>(
          chatQueryKeys.directSummaries(),
          (data: InfiniteData<ChatConversationSummaryPage, ChatPageParam> | undefined) =>
            patchSummaryForMessage(data, incoming, currentUserId !== incoming.senderId && !focused),
        );
        void queryClient.invalidateQueries({ queryKey: chatQueryKeys.directSummaries() });
        return;
      }
      if (event.type !== 'read' || event.receipt.userId === currentUserId) return;
      const seenAt: string | null = getSeenTimestamp(event.receipt);
      const through: ChatMessage | undefined = messagesQuery.messages.find(
        (message: ChatMessage): boolean => message.id === event.receipt.throughMessageId,
      );
      const latestOutgoing: ChatMessage | null = latestOutgoingMessage(messagesQuery.messages, currentUserId);
      if (seenAt && through && latestOutgoing && isMessageAtOrBefore(latestOutgoing, through)) {
        setLatestOutgoingSeenAt((current: string | null): string => {
          if (!current || new Date(seenAt).getTime() > new Date(current).getTime()) return seenAt;
          return current;
        });
        queryClient.setQueryData<InfiniteData<ChatConversationSummaryPage, ChatPageParam>>(
          chatQueryKeys.directSummaries(),
          (data: InfiniteData<ChatConversationSummaryPage, ChatPageParam> | undefined) =>
            patchSummarySeenAt(data, conversationId, seenAt),
        );
      }
    });
    chatSocketClient.setDirectFocus(conversationId, focused);
    return (): void => {
      chatSocketClient.setDirectFocus(conversationId, false);
      unsubscribe();
    };
  }, [accessLost, canRead, conversationId, currentUserId, enabled, focused, messagesQuery.messages, queryClient]);

  useEffect((): void => {
    const previous: ChatConnectionState = previousConnectionState.current;
    previousConnectionState.current = connectionState;
    if (connectionState !== 'connected' || previous === 'connected' || !conversationId || !canRead || accessLost)
      return;
    void messagesQuery.refetch();
  }, [accessLost, canRead, connectionState, conversationId, messagesQuery.refetch]);

  useEffect((): void => {
    if (!focused || !conversationId || !canRead || !canSend || accessLost || !messagesQuery.isSuccess) return;
    const newest: ChatMessage | null = greatestChatMessage(messagesQuery.messages);
    if (!newest || (readCursor.current && compareChatMessages(newest, readCursor.current) <= 0)) return;
    if (pendingReadCursor.current || readMutation.isPending) return;
    pendingReadCursor.current = newest;
    const variables: MarkDirectReadVariables = { conversationId, throughMessageId: newest.id };
    void readMutation
      .mutateAsync(variables)
      .then((result: DirectChatReadResult): void => {
        if (pendingReadCursor.current?.id === newest.id) {
          readCursor.current = newest;
          pendingReadCursor.current = null;
        }
        void result;
      })
      .catch((): void => {
        if (pendingReadCursor.current?.id === newest.id) pendingReadCursor.current = null;
      });
  }, [
    accessLost,
    canRead,
    canSend,
    conversationId,
    focused,
    messagesQuery.isSuccess,
    messagesQuery.messages,
    readMutation,
  ]);

  useEffect((): (() => void) | undefined => {
    const retryAfterUntil: number | undefined = imageDraft?.retryAfterUntil;
    if (!retryAfterUntil || retryAfterUntil <= Date.now()) return;
    const timer: ReturnType<typeof setInterval> = setInterval((): void => {
      setImageRetryClock(Date.now());
      if (Date.now() >= retryAfterUntil) clearInterval(timer);
    }, 250);
    return (): void => clearInterval(timer);
  }, [imageDraft?.retryAfterUntil]);

  const saveFailedDraft = useCallback(
    (
      variables: SendDirectMessageByFriendVariables | SendDirectMessageVariables,
      target: DirectFailedDraft['target'],
      error: Error,
    ): void => {
      setFailedDraftMap(
        (current: Record<string, DirectFailedDraft>): Record<string, DirectFailedDraft> => ({
          ...current,
          [variables.clientMessageId]: {
            clientMessageId: variables.clientMessageId,
            content: variables.content,
            error,
            target,
          },
        }),
      );
    },
    [],
  );

  const clearFailedDraft = useCallback((clientMessageId: string): void => {
    setFailedDraftMap((current: Record<string, DirectFailedDraft>): Record<string, DirectFailedDraft> => {
      if (!(clientMessageId in current)) return current;
      const next: Record<string, DirectFailedDraft> = { ...current };
      delete next[clientMessageId];
      return next;
    });
  }, []);

  const submitMessage = useCallback(
    async (
      content: string,
      clientMessageId: string = createClientMessageId(),
      targetOverride?: DirectFailedDraft['target'],
    ): Promise<void> => {
      if (!canSend || accessLost || inFlightIds.current.has(clientMessageId)) return;
      const target: DirectFailedDraft['target'] =
        targetOverride ??
        (conversationId ? { type: 'conversation', id: conversationId } : { type: 'friend', id: friendUserId });
      if (!target.id) return;
      inFlightIds.current.add(clientMessageId);
      try {
        const result: ChatMessage =
          target.type === 'conversation'
            ? await sendMutation.mutateAsync({ conversationId: target.id, clientMessageId, content })
            : await sendByFriendMutation.mutateAsync({ friendUserId: target.id, clientMessageId, content });
        if (!conversationId && result.conversationId) setCreatedConversationId(result.conversationId);
        clearFailedDraft(clientMessageId);
      } catch (error) {
        if (error instanceof Error && isChatNetworkError(error)) {
          const variables: SendDirectMessageByFriendVariables | SendDirectMessageVariables =
            target.type === 'conversation'
              ? { conversationId: target.id, clientMessageId, content }
              : { friendUserId: target.id, clientMessageId, content };
          saveFailedDraft(variables, target, error);
        }
      } finally {
        inFlightIds.current.delete(clientMessageId);
      }
    },
    [
      accessLost,
      canSend,
      clearFailedDraft,
      conversationId,
      friendUserId,
      saveFailedDraft,
      sendByFriendMutation,
      sendMutation,
    ],
  );

  const sendMessage = useCallback(
    async (content: string): Promise<void> => {
      const trimmed: string = content.trim();
      if (!trimmed) return;
      await submitMessage(trimmed);
    },
    [submitMessage],
  );

  const retryDraft = useCallback(
    async (clientMessageId: string): Promise<void> => {
      const draft: DirectFailedDraft | undefined = failedDraftMap[clientMessageId];
      if (!draft) return;
      await submitMessage(draft.content, draft.clientMessageId, draft.target);
    },
    [failedDraftMap, submitMessage],
  );

  const discardDraft = useCallback(
    (clientMessageId: string): void => clearFailedDraft(clientMessageId),
    [clearFailedDraft],
  );

  const pickImage = useCallback(async (): Promise<void> => {
    if (!canSend || accessLost || imageDraft || sendImageMutation.isPending || sendImageByFriendMutation.isPending)
      return;
    setImagePickerError(null);
    let permissionResult: ImagePicker.MediaLibraryPermissionResponse;
    try {
      permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    } catch {
      setImagePickerError(new Error('Unable to open your photo library.'));
      return;
    }
    if (!permissionResult.granted) {
      setImagePickerError(new Error('Photo access is required to add an image.'));
      return;
    }
    try {
      const result: ImagePicker.ImagePickerResult =
        await ImagePicker.launchImageLibraryAsync(CHAT_IMAGE_PICKER_OPTIONS);
      if (result.canceled || result.assets.length === 0) return;
      const selected: ImagePicker.ImagePickerAsset = result.assets[0];
      const precheckError: string | null = getChatImagePrecheckError(selected);
      if (precheckError) {
        setImagePickerError(new Error(precheckError));
        return;
      }
      setImageDraft({ clientMessageId: createClientMessageId(), asset: toChatImageAsset(selected), status: 'ready' });
    } catch {
      setImagePickerError(new Error('Unable to open your photo library.'));
    }
  }, [accessLost, canSend, imageDraft, sendImageByFriendMutation.isPending, sendImageMutation.isPending]);

  const removeImage = useCallback((): void => {
    if (imageDraft?.status === 'checking') return;
    setImageDraft(null);
    setImagePickerError(null);
  }, [imageDraft?.status]);

  const submitImage = useCallback(
    async (draft: import('@/types/chat.types').ChatImageDraft): Promise<void> => {
      if (!canSubmitImageDraft(draft, canSend, accessLost, inFlightImageIds.current)) return;
      inFlightImageIds.current.add(draft.clientMessageId);
      setImageDraft((current): import('@/types/chat.types').ChatImageDraft | null =>
        current?.clientMessageId === draft.clientMessageId
          ? { ...current, status: 'checking', error: undefined, retryAfterUntil: undefined }
          : current,
      );
      const target: DirectFailedDraft['target'] = conversationId
        ? { type: 'conversation', id: conversationId }
        : { type: 'friend', id: friendUserId };
      try {
        const result: ChatMessage =
          target.type === 'conversation'
            ? await sendImageMutation.mutateAsync({
                conversationId: target.id,
                clientMessageId: draft.clientMessageId,
                file: draft.asset,
              })
            : await sendImageByFriendMutation.mutateAsync({
                friendUserId: target.id,
                clientMessageId: draft.clientMessageId,
                file: draft.asset,
              });
        if (!conversationId && result.conversationId) setCreatedConversationId(result.conversationId);
        setImageDraft((current): import('@/types/chat.types').ChatImageDraft | null =>
          current?.clientMessageId === draft.clientMessageId ? null : current,
        );
        setImagePickerError(null);
      } catch (caughtError: unknown) {
        const error: Error = normalizeCaughtError(caughtError);
        if (getChatImageErrorCode(error) === 'CLIENT_MESSAGE_ID_REUSED') {
          if (conversationId) await messagesQuery.refetch().catch((): void => {});
          setImageDraft((current): import('@/types/chat.types').ChatImageDraft | null =>
            current?.clientMessageId === draft.clientMessageId ? null : current,
          );
          setImagePickerError(new Error('This image could not be sent. Choose it again.'));
        } else {
          setImageDraft((current): import('@/types/chat.types').ChatImageDraft | null =>
            updateImageDraftAfterFailure(current, draft, error),
          );
        }
      } finally {
        inFlightImageIds.current.delete(draft.clientMessageId);
      }
    },
    [
      accessLost,
      canSend,
      conversationId,
      friendUserId,
      messagesQuery.refetch,
      sendImageByFriendMutation,
      sendImageMutation,
    ],
  );

  const sendImage = useCallback(async (): Promise<void> => {
    if (imageDraft?.status === 'ready') await submitImage(imageDraft);
  }, [imageDraft, submitImage]);

  const imageRetryAfterSeconds: number | null = imageDraft?.retryAfterUntil
    ? Math.max(0, Math.ceil((imageDraft.retryAfterUntil - imageRetryClock) / 1000))
    : null;

  const retryImage = useCallback(async (): Promise<void> => {
    if (imageDraft?.status !== 'retryable-failure' || (imageRetryAfterSeconds ?? 0) > 0) return;
    await submitImage(imageDraft);
  }, [imageDraft, imageRetryAfterSeconds, submitImage]);

  const refreshImage = useCallback(
    async (messageId: string): Promise<void> => {
      if (!messageId || !conversationId) return;
      await messagesQuery.refetch();
    },
    [conversationId, messagesQuery.refetch],
  );

  const refetch = useCallback(async (): Promise<void> => {
    if (conversationId && canRead && !accessLost) await messagesQuery.refetch();
  }, [accessLost, canRead, conversationId, messagesQuery.refetch]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (!conversationId || !canRead || accessLost || !messagesQuery.hasNextPage || messagesQuery.isFetchingNextPage)
      return;
    await messagesQuery.fetchNextPage();
  }, [
    accessLost,
    canRead,
    conversationId,
    messagesQuery.fetchNextPage,
    messagesQuery.hasNextPage,
    messagesQuery.isFetchingNextPage,
  ]);

  const friend: DirectChatFriendSummary | null = options.friend ?? null;
  const session: DirectChatSession | null =
    conversationId || friendUserId
      ? {
          conversationId: conversationId || null,
          friendUserId,
          friend,
          canRead,
          canSend,
        }
      : null;
  const latestOutgoing: ChatMessage | null = latestOutgoingMessage(messagesQuery.messages, currentUserId);
  const hasCommittedSeen: boolean = Boolean(
    latestOutgoing &&
      latestOutgoingSeenAt &&
      new Date(latestOutgoingSeenAt).getTime() >= new Date(latestOutgoing.sentAt).getTime(),
  );
  const failedDrafts: DirectFailedDraft[] = Object.values(failedDraftMap);
  const error: Error | null = messagesQuery.error ?? null;
  return {
    session,
    friend,
    conversationId: conversationId || null,
    canRead,
    canSend,
    latestOutgoingSeenAt: hasCommittedSeen ? latestOutgoingSeenAt : null,
    messages: accessLost ? [] : messagesQuery.messages,
    hasNextPage: !accessLost && Boolean(messagesQuery.hasNextPage),
    isFetchingNextPage: !accessLost && messagesQuery.isFetchingNextPage,
    loadMore,
    fetchNextPage: loadMore,
    isLoading: Boolean(conversationId && canRead && !accessLost && messagesQuery.isLoading),
    error,
    refetch,
    isSending:
      sendMutation.isPending ||
      sendByFriendMutation.isPending ||
      sendImageMutation.isPending ||
      sendImageByFriendMutation.isPending ||
      inFlightIds.current.size > 0 ||
      inFlightImageIds.current.size > 0,
    isMarkingRead: readMutation.isPending,
    failedDrafts,
    sendMessage,
    send: sendMessage,
    retryDraft,
    discardDraft,
    imageDraft,
    imagePickerError,
    imageRetryAfterSeconds,
    pickImage,
    removeImage,
    sendImage,
    retryImage,
    refreshImage,
    connectionState: canRead && !accessLost ? connectionState : 'idle',
    accessLost,
    accessRevoked,
    isReadOnly: canRead && !canSend,
  };
}
