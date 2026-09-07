import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { type ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { DirectChatThreadView } from '@/components/chat/DirectChatThreadView';
import { ModerationActionSheet, type ModerationActionTarget } from '@/components/moderation/ModerationActionSheet';
import { Routes } from '@/constants/routes';
import { useMessageReactionMutation, useUnsendMessageMutation } from '@/hooks/mutations/useChatEngagementMutation';
import { useBlockUserMutation, useCreateReportMutation } from '@/hooks/mutations/useModerationMutation';
import { useDirectChatListQuery } from '@/hooks/queries/useChatQuery';
import { useDirectChat } from '@/hooks/useDirectChat';
import { useAuthStore } from '@/store/auth.store';
import { showToast } from '@/store/toast.store';
import type { ChatMessage, ReactionType } from '@/types/chat.types';
import type { DirectChatFriendSummary } from '@/types/direct-chat.types';
import type { CreateReportInput, ModerationReportReceipt } from '@/types/moderation.types';
import { getChatEngagementErrorMessage, isChatMessageUnsendAvailable } from '@/utils/chat-engagement';

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

/**
 * Focused Direct Chat route. `conversation-id=new` is the profile entry point:
 * it keeps the friend target while allowing the first send to create the server
 * conversation lazily.
 *
 * @returns Guarded Direct Chat thread
 */
export default function DirectChatThreadScreen(): ReactElement {
  const params = useLocalSearchParams<{
    'conversation-id': string | string[];
    'friend-user-id'?: string | string[];
    'friend-username'?: string | string[];
    'friend-display-name'?: string | string[];
    'friend-display-picture'?: string | string[];
  }>();
  const router = useRouter();
  const conversationParam: string = firstParam(params['conversation-id']);
  const conversationId: string | undefined =
    conversationParam && conversationParam !== 'new' ? conversationParam : undefined;
  const routeFriendUserId: string = firstParam(params['friend-user-id']);
  const routeFriendUsername: string = firstParam(params['friend-username']);
  const routeFriendDisplayName: string = firstParam(params['friend-display-name']);
  const routeFriendDisplayPicture: string = firstParam(params['friend-display-picture']);
  const summariesQuery = useDirectChatListQuery(Boolean(conversationId));
  const summary = useMemo(
    () => summariesQuery.summaries.find((item) => item.conversationId === conversationId),
    [conversationId, summariesQuery.summaries],
  );
  const routeFriend: DirectChatFriendSummary | null =
    routeFriendUserId && (routeFriendUsername || routeFriendDisplayName)
      ? {
          userId: routeFriendUserId,
          username: routeFriendUsername,
          displayName: routeFriendDisplayName || routeFriendUsername,
          displayPicture: routeFriendDisplayPicture || null,
        }
      : null;
  const friend: DirectChatFriendSummary | null = summary?.friend ?? routeFriend;
  const friendUserId: string | undefined = friend?.userId ?? (routeFriendUserId || undefined);
  const [focused, setFocused] = useState<boolean>(false);
  const chat = useDirectChat({
    conversationId,
    friendUserId,
    friend,
    canRead: summary?.canRead ?? false,
    canSend: summary?.canSend ?? (conversationId === undefined && Boolean(friendUserId)),
    latestOutgoingSeenAt: summary?.latestOutgoingSeenAt ?? null,
    enabled: conversationId === undefined || !summariesQuery.isLoading,
    focused,
  });
  const currentUserId: string | null = useAuthStore((state) => state.user?.id ?? null);
  const reportMutation = useCreateReportMutation();
  const blockMutation = useBlockUserMutation();
  const reactionMutation = useMessageReactionMutation();
  const unsendMutation = useUnsendMessageMutation();
  const [reactionPendingMessageId, setReactionPendingMessageId] = useState<string | null>(null);
  const [moderationTarget, setModerationTarget] = useState<ModerationActionTarget | null>(null);
  const [moderationMessage, setModerationMessage] = useState<ChatMessage | null>(null);

  useFocusEffect(
    useCallback((): (() => void) => {
      setFocused(true);
      return (): void => setFocused(false);
    }, []),
  );

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
    router.replace(Routes.app.chat);
  }, [chat.accessRevoked, router]);

  const onBack = useCallback((): void => {
    if (router.canDismiss()) {
      router.dismiss();
      return;
    }
    router.replace(Routes.app.chat);
  }, [router]);

  return (
    <>
      <DirectChatThreadView
        session={chat.session}
        friend={chat.friend}
        currentUserId={currentUserId}
        messages={chat.messages}
        failedDrafts={chat.failedDrafts}
        latestOutgoingSeenAt={chat.latestOutgoingSeenAt}
        isLoading={chat.isLoading || (Boolean(conversationId) && summariesQuery.isLoading)}
        error={chat.error ?? summariesQuery.error ?? null}
        isSending={chat.isSending}
        isMarkingRead={chat.isMarkingRead}
        connectionState={chat.connectionState}
        hasNextPage={chat.hasNextPage}
        isFetchingNextPage={chat.isFetchingNextPage}
        onBack={onBack}
        onRetry={async (): Promise<void> => {
          await Promise.all([chat.refetch(), summariesQuery.refetch()]);
        }}
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
