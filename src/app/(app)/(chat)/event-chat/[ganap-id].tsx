import { useLocalSearchParams, useRouter } from 'expo-router';
import { type ReactElement, useCallback, useEffect, useState } from 'react';
import { EventChatThreadView } from '@/components/chat/EventChatThreadView';
import { ModerationActionSheet, type ModerationActionTarget } from '@/components/moderation/ModerationActionSheet';
import { Routes } from '@/constants/routes';
import { useBlockUserMutation, useCreateReportMutation } from '@/hooks/mutations/useModerationMutation';
import { useChat } from '@/hooks/useChat';
import { useAuthStore } from '@/store/auth.store';
import { showToast } from '@/store/toast.store';
import type { ChatMessage } from '@/types/chat.types';
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
  const [moderationTarget, setModerationTarget] = useState<ModerationActionTarget | null>(null);

  const openMessageActions = useCallback(
    (message: ChatMessage): void => {
      setModerationTarget({
        type: 'MESSAGE',
        id: message.id,
        senderId: message.senderId,
        senderLabel: message.senderUsername,
        canBlock: currentUserId !== null && message.senderId !== currentUserId,
      });
    },
    [currentUserId],
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
