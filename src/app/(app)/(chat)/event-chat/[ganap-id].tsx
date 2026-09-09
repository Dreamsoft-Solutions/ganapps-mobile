import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { EventChatThreadView } from '@/components/chat/EventChatThreadView';
import { Routes } from '@/constants/routes';
import { useChat } from '@/hooks/useChat';

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

  const onBack = (): void => {
    if (router.canDismiss()) {
      router.dismiss();
      return;
    }
    router.replace(Routes.ganapDetail(ganapId));
  };

  return (
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
      accessLost={chat.accessLost}
    />
  );
}
