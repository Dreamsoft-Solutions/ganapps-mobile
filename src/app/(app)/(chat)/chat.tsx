import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { EventChatListView } from '@/components/chat/EventChatListView';
import { Routes } from '@/constants/routes';
import { useEventChatListQuery } from '@/hooks/queries/useChatQuery';
import type { EventChatSummary } from '@/types/chat.types';

/**
 * Event Chat list tab.
 *
 * The list is intentionally server-owned: it never fabricates rows from Ganap
 * details and never fetches history for each row.
 *
 * @returns The Event Chat list screen.
 */
export default function ChatScreen(): ReactElement {
  const router = useRouter();
  const list = useEventChatListQuery();

  return (
    <EventChatListView
      summaries={list.summaries}
      isLoading={list.isLoading}
      error={list.error}
      isRefreshing={list.isRefetching}
      onRefresh={async (): Promise<void> => {
        await list.refetch();
      }}
      onRetry={async (): Promise<void> => {
        await list.refetch();
      }}
      onLoadMore={async (): Promise<void> => {
        await list.fetchNextPage();
      }}
      hasNextPage={Boolean(list.hasNextPage)}
      isFetchingNextPage={list.isFetchingNextPage}
      onOpen={(summary: EventChatSummary): void => {
        router.push(Routes.eventChat(summary.ganapId));
      }}
    />
  );
}
