import { type InfiniteData, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BLOCKED_USERS_PAGE_SIZE, moderationAPI } from '@/api/endpoints/moderation';
import {
  type MarkChatReadVariables,
  type SendChatMessageVariables,
  useMarkChatReadMutation,
  useSendChatImageMutation,
  useSendChatMessageMutation,
} from '@/hooks/mutations/useChatMutation';
import {
  type ChatPageParam,
  chatQueryKeys,
  useEventChatMessagesQuery,
  useEventChatSessionQuery,
} from '@/hooks/queries/useChatQuery';
import { ganapQueryKeys } from '@/hooks/queries/useGanapsQuery';
import { type ModerationPageParam, moderationQueryKeys } from '@/hooks/queries/useModerationQuery';
import {
  type ChatConnectionState,
  type ChatSocketEvent,
  type ChatSocketModerationEvent,
  chatSocketClient,
} from '@/services/chat-socket.service';
import { useAuthStore } from '@/store/auth.store';
import type {
  ChatImageDraft,
  ChatMessage,
  ChatMessagesPage,
  EventChatSession,
  EventChatSummary,
  EventChatSummaryPage,
} from '@/types/chat.types';
import type { BlockedUsersPage } from '@/types/moderation.types';
import {
  compareChatMessagePositions,
  compareChatMessages,
  getChatMessagePreview,
  greatestChatMessage,
  isChatForbidden,
  isChatNetworkError,
  upsertChatMessage,
} from '@/utils/chat';
import { markMessageUnsent, patchMessageInPages } from '@/utils/chat-engagement';
import {
  CHAT_IMAGE_PICKER_OPTIONS,
  getChatImageErrorCode,
  getChatImagePrecheckError,
  getChatImageRetryAfterSeconds,
  isRetryableChatImageError,
  toChatImageAsset,
} from '@/utils/chat-image';
import { isUserBlocked } from '@/utils/moderation';

/** A failed in-memory send that can be retried with the same client id. */
export interface FailedDraft {
  clientMessageId: string;
  content: string;
  error: Error;
}

/** Public aggregate returned by {@link useChat}. */
export interface UseChatResult {
  session: EventChatSession | null;
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
  failedDrafts: FailedDraft[];
  sendMessage: (content: string) => Promise<void>;
  /** Short alias useful for composer components. */
  send: (content: string) => Promise<void>;
  retryDraft: (clientMessageId: string) => Promise<void>;
  discardDraft: (clientMessageId: string) => void;
  imageDraft: ChatImageDraft | null;
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
  draft: ChatImageDraft,
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
  current: ChatImageDraft | null,
  draft: ChatImageDraft,
  error: Error,
): ChatImageDraft | null {
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
  const nextFirstPage: ChatMessagesPage = {
    ...firstPage,
    items: upsertChatMessage(firstPage.items, message),
  };
  return {
    ...data,
    pages: [
      nextFirstPage,
      ...remainingPages.map(
        (page: ChatMessagesPage): ChatMessagesPage => ({
          ...page,
          items: page.items.filter((item: ChatMessage): boolean => item.id !== message.id),
        }),
      ),
    ],
  };
}

function patchSummaryForMessage(
  data: InfiniteData<EventChatSummaryPage, ChatPageParam> | undefined,
  message: ChatMessage,
  incrementUnread: boolean,
): InfiniteData<EventChatSummaryPage, ChatPageParam> | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map(
      (page: EventChatSummaryPage): EventChatSummaryPage => ({
        ...page,
        items: page.items.map(
          (summary: EventChatSummary): EventChatSummary =>
            summary.conversationId !== message.conversationId ||
            (summary.lastMessage !== null && compareChatMessagePositions(message, summary.lastMessage) <= 0)
              ? summary
              : {
                  ...summary,
                  lastMessage: {
                    id: message.id,
                    type: message.type,
                    preview: getChatMessagePreview(message),
                    sentAt: message.sentAt,
                  },
                  unreadCount: incrementUnread ? summary.unreadCount + 1 : summary.unreadCount,
                  updatedAt: message.sentAt,
                },
        ),
      }),
    ),
  };
}

function patchSummaryRead(
  data: InfiniteData<EventChatSummaryPage, ChatPageParam> | undefined,
  conversationId: string,
): InfiniteData<EventChatSummaryPage, ChatPageParam> | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map(
      (page: EventChatSummaryPage): EventChatSummaryPage => ({
        ...page,
        items: page.items.map(
          (summary: EventChatSummary): EventChatSummary =>
            summary.conversationId === conversationId ? { ...summary, unreadCount: 0 } : summary,
        ),
      }),
    ),
  };
}

function removeHiddenMessage(
  data: InfiniteData<ChatMessagesPage, ChatPageParam> | undefined,
  messageId: string,
  conversationId: string,
): InfiniteData<ChatMessagesPage, ChatPageParam> | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map(
      (page: ChatMessagesPage): ChatMessagesPage => ({
        ...page,
        items: page.items.filter(
          (message: ChatMessage): boolean => message.id !== messageId || message.conversationId !== conversationId,
        ),
      }),
    ),
  };
}

/**
 * Aggregates Event Chat session, history, REST mutations, socket events, and
 * in-memory failed sends for one focused Ganap thread.
 *
 * Calling with no Ganap id is supported for shared list screens: it remains
 * idle and never creates a history query or socket room.
 *
 * @param ganapId - Optional Event Chat Ganap id
 * @param enabled - Optional route/access guard
 * @returns Named Event Chat aggregate state and actions
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: The aggregate owns the explicit session, access, socket, read, and failed-draft state transitions.
export function useChat(ganapId = '', enabled = true): UseChatResult {
  const queryClient = useQueryClient();
  const userId: string | null = useAuthStore((state) => state.user?.id ?? null);
  const [accessRevoked, setAccessRevoked] = useState<boolean>(false);
  const sessionQuery = useEventChatSessionQuery(ganapId, enabled && Boolean(ganapId) && !accessRevoked);
  const canRead: boolean = sessionQuery.data?.canRead === true;
  const sessionAccessLost: boolean = Boolean(
    isChatForbidden(sessionQuery.error) || (sessionQuery.data !== undefined && !sessionQuery.data.canRead),
  );
  const messagesQuery = useEventChatMessagesQuery(ganapId, enabled && canRead && !sessionAccessLost && !accessRevoked);
  const accessLost: boolean = accessRevoked || sessionAccessLost || isChatForbidden(messagesQuery.error);
  const sendMutation = useSendChatMessageMutation();
  const sendImageMutation = useSendChatImageMutation();
  const readMutation = useMarkChatReadMutation();
  const [failedDraftMap, setFailedDraftMap] = useState<Record<string, FailedDraft>>({});
  const [imageDraft, setImageDraft] = useState<ChatImageDraft | null>(null);
  const [imagePickerError, setImagePickerError] = useState<Error | null>(null);
  const [imageRetryClock, setImageRetryClock] = useState<number>(Date.now());
  const [connectionState, setConnectionState] = useState<ChatConnectionState>(chatSocketClient.getConnectionState());
  const inFlightIds = useRef<Set<string>>(new Set<string>());
  const inFlightImageIds = useRef<Set<string>>(new Set<string>());
  const readCursor = useRef<ChatMessage | null>(null);
  const previousConversationId = useRef<string | null>(null);
  const previousGanapId = useRef<string>(ganapId);
  const previousConnectionState = useRef<ChatConnectionState>(connectionState);

  const refreshBlocksBeforeJoin = useCallback(async (): Promise<void> => {
    const page = await moderationAPI.listBlocks({ limit: BLOCKED_USERS_PAGE_SIZE });
    queryClient.setQueryData<InfiniteData<BlockedUsersPage, ModerationPageParam>>(
      moderationQueryKeys.blocks(),
      (
        _current: InfiniteData<BlockedUsersPage, ModerationPageParam> | undefined,
      ): InfiniteData<BlockedUsersPage, ModerationPageParam> => ({
        // Reconnect must discard old cursor pages: a block/unblock on another
        // device can change every page boundary, not just the first page.
        pages: [page],
        pageParams: [undefined],
      }),
    );
  }, [queryClient]);

  useEffect((): (() => void) => chatSocketClient.setBeforeJoin(refreshBlocksBeforeJoin), [refreshBlocksBeforeJoin]);

  const handleModerationEvent = useCallback(
    (moderationEvent: ChatSocketModerationEvent): void => {
      if (moderationEvent.type === 'message-hidden') {
        if (accessRevoked) return;
        const conversationId: string | undefined = sessionQuery.data?.conversationId;
        if (!conversationId || moderationEvent.event.conversationId !== conversationId) return;
        queryClient.setQueriesData<InfiniteData<ChatMessagesPage, ChatPageParam>>(
          { queryKey: chatQueryKeys.eventMessages(ganapId) },
          (data: InfiniteData<ChatMessagesPage, ChatPageParam> | undefined) =>
            removeHiddenMessage(data, moderationEvent.event.messageId, conversationId),
        );
        void queryClient.invalidateQueries({ queryKey: chatQueryKeys.eventMessages(ganapId) });
        void queryClient.invalidateQueries({ queryKey: chatQueryKeys.eventList() });
        void queryClient.invalidateQueries({ queryKey: chatQueryKeys.summaries() });
        return;
      }

      if (accessRevoked || !ganapId || moderationEvent.event.ganapId !== ganapId) return;
      if (!sessionQuery.data || moderationEvent.event.conversationId !== sessionQuery.data.conversationId) return;
      setAccessRevoked(true);
      chatSocketClient.leaveConversation(moderationEvent.event.conversationId);
      void (async (): Promise<void> => {
        await Promise.all([
          queryClient.cancelQueries({ queryKey: chatQueryKeys.eventMessages(ganapId) }),
          queryClient.cancelQueries({ queryKey: chatQueryKeys.eventSession(ganapId) }),
        ]);
        queryClient.removeQueries({ queryKey: chatQueryKeys.eventMessages(ganapId), exact: true });
        queryClient.removeQueries({ queryKey: chatQueryKeys.eventSession(ganapId), exact: true });
        await Promise.allSettled([
          queryClient.invalidateQueries({ queryKey: ganapQueryKeys.all }),
          queryClient.invalidateQueries({ queryKey: chatQueryKeys.eventList() }),
          queryClient.invalidateQueries({ queryKey: chatQueryKeys.summaries() }),
        ]);
      })();
    },
    [accessRevoked, ganapId, queryClient, sessionQuery.data],
  );

  useEffect((): (() => void) => chatSocketClient.onModerationEvent(handleModerationEvent), [handleModerationEvent]);

  useEffect((): (() => void) => {
    return chatSocketClient.onConnectionStateChange((nextState: ChatConnectionState): void => {
      setConnectionState(nextState);
    });
  }, []);

  useEffect((): (() => void) | undefined => {
    if (!sessionQuery.data || !canRead || accessLost) return;
    const conversationId: string = sessionQuery.data.conversationId;
    const unsubscribe: () => void = chatSocketClient.subscribe(
      conversationId,
      sessionQuery.data.ganapId,
      (event: ChatSocketEvent): void => {
        if (event.type === 'message') {
          const incoming: ChatMessage = event.message;
          if (incoming.conversationId !== conversationId) return;
          if (isUserBlocked(queryClient, incoming.senderId)) return;
          queryClient.setQueryData<InfiniteData<ChatMessagesPage, ChatPageParam>>(
            chatQueryKeys.eventMessages(ganapId),
            (data: InfiniteData<ChatMessagesPage, ChatPageParam> | undefined) => upsertMessageInPages(data, incoming),
          );
          queryClient.setQueryData<InfiniteData<EventChatSummaryPage, ChatPageParam>>(
            chatQueryKeys.eventList(),
            (data: InfiniteData<EventChatSummaryPage, ChatPageParam> | undefined) =>
              patchSummaryForMessage(data, incoming, userId !== null && incoming.senderId !== userId),
          );
          void queryClient.invalidateQueries({ queryKey: chatQueryKeys.eventList() });
          void queryClient.invalidateQueries({ queryKey: chatQueryKeys.summaries() });
          return;
        }
        if (event.type === 'message-reaction') {
          const reaction = event.event;
          if (reaction.conversationId !== conversationId) return;
          queryClient.setQueryData<InfiniteData<ChatMessagesPage, ChatPageParam>>(
            chatQueryKeys.eventMessages(ganapId),
            (data: InfiniteData<ChatMessagesPage, ChatPageParam> | undefined) =>
              patchMessageInPages(
                data,
                conversationId,
                reaction.messageId,
                (message: ChatMessage): ChatMessage => ({
                  ...message,
                  reactionSummary: {
                    total: reaction.counts.reduce((total: number, entry): number => total + entry.count, 0),
                    counts: reaction.counts,
                    myReaction: reaction.myReaction,
                  },
                }),
              ),
          );
          return;
        }
        if (event.type === 'message-unsent') {
          if (event.event.conversationId !== conversationId) return;
          queryClient.setQueryData<InfiniteData<ChatMessagesPage, ChatPageParam>>(
            chatQueryKeys.eventMessages(ganapId),
            (data: InfiniteData<ChatMessagesPage, ChatPageParam> | undefined) => markMessageUnsent(data, event.event),
          );
          void queryClient.invalidateQueries({ queryKey: chatQueryKeys.eventList() });
          void queryClient.invalidateQueries({ queryKey: chatQueryKeys.summaries() });
          return;
        }
        if (event.type === 'read' && event.receipt.userId === userId) {
          queryClient.setQueryData<InfiniteData<EventChatSummaryPage, ChatPageParam>>(
            chatQueryKeys.eventList(),
            (data: InfiniteData<EventChatSummaryPage, ChatPageParam> | undefined) =>
              patchSummaryRead(data, event.receipt.conversationId),
          );
          void queryClient.invalidateQueries({ queryKey: chatQueryKeys.summaries() });
        }
      },
    );
    return unsubscribe;
  }, [accessLost, canRead, ganapId, queryClient, sessionQuery.data, userId]);

  useEffect((): void => {
    const conversationId: string | null = sessionQuery.data?.conversationId ?? null;
    if (conversationId === previousConversationId.current) return;
    previousConversationId.current = conversationId;
    readCursor.current = null;
  }, [sessionQuery.data?.conversationId]);

  useEffect((): void => {
    if (previousGanapId.current === ganapId) return;
    previousGanapId.current = ganapId;
    setAccessRevoked(false);
    setImageDraft(null);
    setImagePickerError(null);
  }, [ganapId]);

  useEffect((): (() => void) | undefined => {
    const retryAfterUntil: number | undefined = imageDraft?.retryAfterUntil;
    if (!retryAfterUntil || retryAfterUntil <= Date.now()) return undefined;
    const timer: ReturnType<typeof setInterval> = setInterval((): void => {
      setImageRetryClock(Date.now());
      if (Date.now() >= retryAfterUntil) clearInterval(timer);
    }, 250);
    return (): void => clearInterval(timer);
  }, [imageDraft?.retryAfterUntil]);

  useEffect((): void => {
    const previous: ChatConnectionState = previousConnectionState.current;
    previousConnectionState.current = connectionState;
    if (connectionState !== 'connected' || previous === 'connected' || !canRead || !ganapId) return;
    void messagesQuery.refetch();
  }, [canRead, connectionState, ganapId, messagesQuery.refetch]);

  useEffect((): void => {
    if (!accessLost || !ganapId) return;
    queryClient.removeQueries({ queryKey: chatQueryKeys.eventMessages(ganapId), exact: true });
    readCursor.current = null;
  }, [accessLost, ganapId, queryClient]);

  useEffect((): void => {
    if (!canRead || accessLost || !messagesQuery.isSuccess || messagesQuery.messages.length === 0) return;
    const newest: ChatMessage | null = greatestChatMessage(messagesQuery.messages);
    if (!newest || (readCursor.current && compareChatMessages(newest, readCursor.current) <= 0)) return;
    if (readMutation.isPending) return;
    readCursor.current = newest;
    const variables: MarkChatReadVariables = { ganapId, throughMessageId: newest.id };
    void readMutation.mutateAsync(variables).catch((): void => {
      // The visible thread remains usable when read bookkeeping is offline;
      // a later foreground load can advance the cursor again.
    });
  }, [accessLost, canRead, ganapId, messagesQuery.isSuccess, messagesQuery.messages, readMutation]);

  const saveFailedDraft = useCallback((variables: SendChatMessageVariables, error: Error): void => {
    setFailedDraftMap(
      (current: Record<string, FailedDraft>): Record<string, FailedDraft> => ({
        ...current,
        [variables.clientMessageId]: {
          clientMessageId: variables.clientMessageId,
          content: variables.content,
          error,
        },
      }),
    );
  }, []);

  const clearFailedDraft = useCallback((clientMessageId: string): void => {
    setFailedDraftMap((current: Record<string, FailedDraft>): Record<string, FailedDraft> => {
      if (!(clientMessageId in current)) return current;
      const next: Record<string, FailedDraft> = { ...current };
      delete next[clientMessageId];
      return next;
    });
  }, []);

  const submitMessage = useCallback(
    async (variables: SendChatMessageVariables): Promise<void> => {
      if (!sessionQuery.data?.canSend || accessLost || inFlightIds.current.has(variables.clientMessageId)) return;
      inFlightIds.current.add(variables.clientMessageId);
      try {
        await sendMutation.mutateAsync(variables);
        // A successful REST response is the canonical reconciliation point,
        // including an idempotent duplicate response after a retry.
        clearFailedDraft(variables.clientMessageId);
      } catch (error) {
        if (error instanceof Error && isChatNetworkError(error)) saveFailedDraft(variables, error);
      } finally {
        inFlightIds.current.delete(variables.clientMessageId);
      }
    },
    [accessLost, clearFailedDraft, saveFailedDraft, sendMutation, sessionQuery.data],
  );

  const sendMessage = useCallback(
    async (content: string): Promise<void> => {
      if (!sessionQuery.data?.canSend || accessLost) return;
      const trimmed: string = content.trim();
      if (!trimmed) return;
      await submitMessage({ ganapId, clientMessageId: createClientMessageId(), content: trimmed });
    },
    [accessLost, ganapId, sessionQuery.data, submitMessage],
  );

  const retryDraft = useCallback(
    async (clientMessageId: string): Promise<void> => {
      const draft: FailedDraft | undefined = failedDraftMap[clientMessageId];
      if (!draft) return;
      await submitMessage({ ganapId, clientMessageId: draft.clientMessageId, content: draft.content });
    },
    [failedDraftMap, ganapId, submitMessage],
  );

  const discardDraft = useCallback(
    (clientMessageId: string): void => {
      clearFailedDraft(clientMessageId);
    },
    [clearFailedDraft],
  );

  const pickImage = useCallback(async (): Promise<void> => {
    if (!sessionQuery.data?.canSend || accessLost || imageDraft || sendImageMutation.isPending) return;
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
      setImageDraft({
        clientMessageId: createClientMessageId(),
        asset: toChatImageAsset(selected),
        status: 'ready',
      });
    } catch {
      setImagePickerError(new Error('Unable to open your photo library.'));
    }
  }, [accessLost, imageDraft, sendImageMutation.isPending, sessionQuery.data]);

  const removeImage = useCallback((): void => {
    if (imageDraft?.status === 'checking') return;
    setImageDraft(null);
    setImagePickerError(null);
  }, [imageDraft?.status]);

  const submitImage = useCallback(
    async (draft: ChatImageDraft): Promise<void> => {
      if (!canSubmitImageDraft(draft, sessionQuery.data?.canSend === true, accessLost, inFlightImageIds.current))
        return;
      inFlightImageIds.current.add(draft.clientMessageId);
      setImageDraft((current: ChatImageDraft | null): ChatImageDraft | null =>
        current?.clientMessageId === draft.clientMessageId
          ? { ...current, status: 'checking', error: undefined, retryAfterUntil: undefined }
          : current,
      );
      try {
        await sendImageMutation.mutateAsync({
          ganapId,
          clientMessageId: draft.clientMessageId,
          file: draft.asset,
        });
        setImageDraft((current: ChatImageDraft | null): ChatImageDraft | null =>
          current?.clientMessageId === draft.clientMessageId ? null : current,
        );
        setImagePickerError(null);
      } catch (caughtError: unknown) {
        const error: Error = normalizeCaughtError(caughtError);
        const errorCode: string | undefined = getChatImageErrorCode(error);
        if (errorCode === 'CLIENT_MESSAGE_ID_REUSED') {
          try {
            await messagesQuery.refetch();
          } catch {
            // The safe reconciliation copy below remains correct if history is offline.
          }
          setImageDraft((current: ChatImageDraft | null): ChatImageDraft | null =>
            current?.clientMessageId === draft.clientMessageId ? null : current,
          );
          setImagePickerError(new Error('This image could not be sent. Choose it again.'));
        } else {
          setImageDraft((current: ChatImageDraft | null): ChatImageDraft | null =>
            updateImageDraftAfterFailure(current, draft, error),
          );
        }
      } finally {
        inFlightImageIds.current.delete(draft.clientMessageId);
      }
    },
    [accessLost, ganapId, messagesQuery.refetch, sendImageMutation, sessionQuery.data],
  );

  const imageRetryAfterSeconds: number | null = imageDraft?.retryAfterUntil
    ? Math.max(0, Math.ceil((imageDraft.retryAfterUntil - imageRetryClock) / 1000))
    : null;

  const sendImage = useCallback(async (): Promise<void> => {
    if (imageDraft?.status !== 'ready') return;
    await submitImage(imageDraft);
  }, [imageDraft, submitImage]);

  const retryImage = useCallback(async (): Promise<void> => {
    if (imageDraft?.status !== 'retryable-failure' || (imageRetryAfterSeconds ?? 0) > 0) return;
    await submitImage(imageDraft);
  }, [imageDraft, imageRetryAfterSeconds, submitImage]);

  const refreshImage = useCallback(
    async (messageId: string): Promise<void> => {
      if (!messageId) return;
      await messagesQuery.refetch();
    },
    [messagesQuery.refetch],
  );

  const refetch = useCallback(async (): Promise<void> => {
    const refreshedSession = await sessionQuery.refetch();
    const refreshedCanRead: boolean = refreshedSession.data?.canRead === true;
    const refreshedAccessLost: boolean =
      isChatForbidden(refreshedSession.error) || (refreshedSession.data !== undefined && !refreshedCanRead);
    if (refreshedCanRead && !refreshedAccessLost) await messagesQuery.refetch();
  }, [messagesQuery.refetch, sessionQuery.refetch]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (!canRead || accessLost || !messagesQuery.hasNextPage || messagesQuery.isFetchingNextPage) return;
    await messagesQuery.fetchNextPage();
  }, [accessLost, canRead, messagesQuery.fetchNextPage, messagesQuery.hasNextPage, messagesQuery.isFetchingNextPage]);

  const messages: ChatMessage[] = accessLost ? [] : messagesQuery.messages;
  const error: Error | null = sessionQuery.error ?? messagesQuery.error ?? null;
  const failedDrafts: FailedDraft[] = Object.values(failedDraftMap);
  const isReadOnly: boolean = Boolean(sessionQuery.data?.canRead && !sessionQuery.data.canSend);

  return {
    session: accessLost ? (sessionQuery.data ?? null) : (sessionQuery.data ?? null),
    messages,
    hasNextPage: !accessLost && Boolean(messagesQuery.hasNextPage),
    isFetchingNextPage: !accessLost && messagesQuery.isFetchingNextPage,
    loadMore,
    fetchNextPage: loadMore,
    isLoading: sessionQuery.isLoading || (!accessLost && canRead && messagesQuery.isLoading),
    error,
    refetch,
    isSending: sendMutation.isPending || sendImageMutation.isPending || inFlightIds.current.size > 0,
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
    isReadOnly,
  };
}
