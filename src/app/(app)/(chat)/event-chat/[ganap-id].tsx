import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { type ReactElement, useCallback, useEffect, useState } from 'react';
import { EventChatThreadView } from '@/components/chat/EventChatThreadView';
import { ModerationActionSheet, type ModerationActionTarget } from '@/components/moderation/ModerationActionSheet';
import { Routes } from '@/constants/routes';
import { useMessageReactionMutation, useUnsendMessageMutation } from '@/hooks/mutations/useChatEngagementMutation';
import { useBlockUserMutation, useCreateReportMutation } from '@/hooks/mutations/useModerationMutation';
import { useGanapDetailQuery } from '@/hooks/queries/useGanapsQuery';
import { useChat } from '@/hooks/useChat';
import { useAuthStore } from '@/store/auth.store';
import { showToast } from '@/store/toast.store';
import type { ChatMessage, ReactionType } from '@/types/chat.types';
import type { CreateReportInput, ModerationReportReceipt } from '@/types/moderation.types';
import { getChatEngagementErrorMessage, isChatMessageUnsendAvailable } from '@/utils/chat-engagement';

/**
 * Resolves the focused Event Chat session before rendering its history.
 * Navigation remains route-owned while the aggregate owns server state and
 * process-wide socket subscription lifecycle.
 *
 * @returns Guarded Event Chat thread
 */
export default function EventChatThreadScreen(): ReactElement {
  const params = useLocalSearchParams<{ 'ganap-id': string | string[] }>();
  const rawGanapId: string | string[] | undefined = params['ganap-id'];
  const ganapId: string = Array.isArray(rawGanapId) ? (rawGanapId[0] ?? '') : (rawGanapId ?? '');
  const router = useRouter();
  const { data: ganap } = useGanapDetailQuery(ganapId);
  const headerTitle: string = ganap?.title?.trim() || 'Event Chat';
  const chat = useChat(ganapId);
  const currentUserId: string | null = useAuthStore((state) => state.user?.id ?? null);
  const reportMutation = useCreateReportMutation();
  const blockMutation = useBlockUserMutation();
  const reactionMutation = useMessageReactionMutation();
  const unsendMutation = useUnsendMessageMutation();
  const [reactionPendingMessageId, setReactionPendingMessageId] = useState<string | null>(null);
  const [moderationTarget, setModerationTarget] = useState<ModerationActionTarget | null>(null);
  const [moderationMessage, setModerationMessage] = useState<ChatMessage | null>(null);

  const openMessageActions = useCallback(
    (message: ChatMessage): void => {
      setModerationMessage(message);
      setModerationTarget({
        type: 'MESSAGE',
        id: message.id,
        senderId: message.senderId,
        senderLabel: message.senderUsername,
        canBlock: currentUserId !== null && message.senderId !== currentUserId,
        canUnsend: isChatMessageUnsendAvailable(message, currentUserId, chat.session?.canSend === true),
        reactionSummary: message.type === 'UNSENT' ? null : message.reactionSummary,
        canReact: chat.session?.canSend === true,
      });
    },
    [chat.session?.canSend, currentUserId],
  );

  const onReaction = useCallback(
    async (message: ChatMessage, reaction: ReactionType | null): Promise<void> => {
      if (message.type === 'UNSENT' || chat.session?.canSend !== true || reactionMutation.isPending) return;
      setReactionPendingMessageId(message.id);
      try {
        const summary = await reactionMutation.mutateAsync({
          conversationId: message.conversationId,
          messageId: message.id,
          reaction,
        });
        setModerationMessage((selected: ChatMessage | null): ChatMessage | null =>
          selected?.id === message.id ? { ...selected, reactionSummary: summary } : selected,
        );
        setModerationTarget((selected: ModerationActionTarget | null): ModerationActionTarget | null =>
          selected?.type === 'MESSAGE' && selected.id === message.id
            ? { ...selected, reactionSummary: summary }
            : selected,
        );
      } catch (error: unknown) {
        showToast('error', getChatEngagementErrorMessage(error, 'Reaction could not be saved.'));
      } finally {
        setReactionPendingMessageId(null);
      }
    },
    [chat.session?.canSend, reactionMutation],
  );

  const closeModeration = useCallback((): void => {
    setModerationTarget(null);
    setModerationMessage(null);
  }, []);

  const unsendFromActions = useCallback(async (): Promise<void> => {
    const message: ChatMessage | null = moderationMessage;
    if (
      !message ||
      !isChatMessageUnsendAvailable(message, currentUserId, chat.session?.canSend === true) ||
      unsendMutation.isPending
    ) {
      throw new Error('This message can no longer be unsent.');
    }
    try {
      await unsendMutation.mutateAsync({ conversationId: message.conversationId, messageId: message.id });
    } catch (error: unknown) {
      throw new Error(getChatEngagementErrorMessage(error, 'This message could not be unsent.'));
    }
  }, [chat.session?.canSend, currentUserId, moderationMessage, unsendMutation]);

  const submitReport = useCallback(
    (input: CreateReportInput): Promise<ModerationReportReceipt> => reportMutation.mutateAsync(input),
    [reportMutation],
  );

  const blockUser = useCallback(
    (userId: string): Promise<void> => blockMutation.mutateAsync({ userId }),
    [blockMutation],
  );

  useEffect((): void => {
    if (!chat.accessRevoked) return;
    showToast('info', 'You no longer have access to this chat.');
    router.replace(Routes.eventHub(ganapId));
  }, [chat.accessRevoked, ganapId, router]);

  const onBack = (): void => {
    if (router.canDismiss()) {
      router.dismiss();
      return;
    }
    router.replace(Routes.ganapDetail(ganapId));
  };

  return (
    <>
      <Stack.Screen options={{ title: headerTitle }} />
      <EventChatThreadView
        session={chat.session}
        messages={chat.messages}
        failedDrafts={chat.failedDrafts}
        isLoading={chat.isLoading}
        error={chat.error}
        isSending={chat.isSending}
        isMarkingRead={chat.isMarkingRead}
        connectionState={chat.connectionState}
        hasNextPage={chat.hasNextPage}
        isFetchingNextPage={chat.isFetchingNextPage}
        onBack={onBack}
        onRetry={chat.refetch}
        onLoadMore={chat.loadMore}
        onSend={chat.sendMessage}
        onRetryDraft={chat.retryDraft}
        onDiscardDraft={chat.discardDraft}
        imageDraft={chat.imageDraft}
        imagePickerError={chat.imagePickerError}
        imageRetryAfterSeconds={chat.imageRetryAfterSeconds}
        onPickImage={chat.pickImage}
        onRemoveImage={chat.removeImage}
        onSendImage={chat.sendImage}
        onRetryImage={chat.retryImage}
        onRefreshImage={chat.refreshImage}
        onMessageActions={openMessageActions}
        accessLost={chat.accessLost}
      />
      <ModerationActionSheet
        visible={moderationTarget !== null}
        target={moderationTarget}
        onClose={closeModeration}
        onReport={submitReport}
        onBlock={blockUser}
        onUnsend={unsendFromActions}
        onReaction={(reaction: ReactionType | null): Promise<void> => {
          const message: ChatMessage | null = moderationMessage;
          if (!message) return Promise.resolve();
          return onReaction(message, reaction);
        }}
        reactionPending={reactionPendingMessageId === moderationMessage?.id}
      />
    </>
  );
}
