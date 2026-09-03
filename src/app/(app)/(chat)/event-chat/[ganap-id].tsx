import { useLocalSearchParams, useRouter } from 'expo-router';
import { type ReactElement, useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { EventChatThreadView } from '@/components/chat/EventChatThreadView';
import { ModerationActionSheet, type ModerationActionTarget } from '@/components/moderation/ModerationActionSheet';
import { Routes } from '@/constants/routes';
import { useMessageReactionMutation, useUnsendMessageMutation } from '@/hooks/mutations/useChatEngagementMutation';
import { useBlockUserMutation, useCreateReportMutation } from '@/hooks/mutations/useModerationMutation';
import { useChat } from '@/hooks/useChat';
import { useAuthStore } from '@/store/auth.store';
import { showToast } from '@/store/toast.store';
import type { ChatMessage, ReactionType } from '@/types/chat.types';
import type { CreateReportInput, ModerationReportReceipt } from '@/types/moderation.types';

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
  const chat = useChat(ganapId);
  const currentUserId: string | null = useAuthStore((state) => state.user?.id ?? null);
  const reportMutation = useCreateReportMutation();
  const blockMutation = useBlockUserMutation();
  const reactionMutation = useMessageReactionMutation();
  const unsendMutation = useUnsendMessageMutation();
  const [reactionPendingMessageId, setReactionPendingMessageId] = useState<string | null>(null);
  const [moderationTarget, setModerationTarget] = useState<ModerationActionTarget | null>(null);

  const confirmUnsend = useCallback(
    (message: ChatMessage): void => {
      if (message.type === 'UNSENT' || message.senderId !== currentUserId || unsendMutation.isPending) return;
      Alert.alert('Unsend message?', 'This message will be replaced for everyone in the conversation.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unsend for everyone',
          style: 'destructive',
          onPress: (): void => {
            void unsendMutation
              .mutateAsync({ conversationId: message.conversationId, messageId: message.id })
              .then((): void => {
                showToast('success', 'Message unsent.');
              })
              .catch((): void => {
                showToast('error', 'This message could not be unsent.');
              });
          },
        },
      ]);
    },
    [currentUserId, unsendMutation],
  );

  const openMessageActions = useCallback(
    (message: ChatMessage): void => {
      if (message.senderId === currentUserId) {
        confirmUnsend(message);
        return;
      }
      setModerationTarget({
        type: 'MESSAGE',
        id: message.id,
        senderId: message.senderId,
        senderLabel: message.senderUsername,
        canBlock: currentUserId !== null && message.senderId !== currentUserId,
      });
    },
    [confirmUnsend, currentUserId],
  );

  const onReaction = useCallback(
    async (message: ChatMessage, reaction: ReactionType | null): Promise<void> => {
      if (message.type === 'UNSENT' || reactionMutation.isPending) return;
      setReactionPendingMessageId(message.id);
      try {
        await reactionMutation.mutateAsync({
          conversationId: message.conversationId,
          messageId: message.id,
          reaction,
        });
      } catch {
        showToast('error', 'Reaction could not be saved.');
      } finally {
        setReactionPendingMessageId(null);
      }
    },
    [reactionMutation],
  );

  const closeModeration = useCallback((): void => {
    setModerationTarget(null);
  }, []);

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
        onReaction={onReaction}
        reactionPendingMessageId={reactionPendingMessageId}
        accessLost={chat.accessLost}
      />
      <ModerationActionSheet
        visible={moderationTarget !== null}
        target={moderationTarget}
        onClose={closeModeration}
        onReport={submitReport}
        onBlock={blockUser}
      />
    </>
  );
}
