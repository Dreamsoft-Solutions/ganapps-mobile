import { MessageCircle } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/common/Avatar';
import { Card } from '@/components/common/Card';
import { Empty } from '@/components/common/Empty';
import { ErrorView } from '@/components/common/Error';
import { Loading } from '@/components/common/Loading';
import { Text } from '@/components/common/Text';
import { BAR_HEIGHT } from '@/components/navigation/AppTabBar';
import { Colors, Spacing } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import type { EventChatSummary } from '@/types/chat.types';

/** Props for the server-ordered Event Chat list. */
export interface EventChatListViewProps {
  summaries: EventChatSummary[];
  isLoading: boolean;
  error: Error | null;
  isRefreshing: boolean;
  onRefresh: () => void | Promise<void>;
  onRetry: () => void | Promise<void>;
  onLoadMore: () => void | Promise<void>;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onOpen: (summary: EventChatSummary) => void;
}

function formatChatTime(value: string | null): string {
  if (!value) return 'No messages yet';
  const date: Date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
}

function getSummaryPreview(summary: EventChatSummary): string {
  if (!summary.lastMessage) return 'No messages yet';
  if (summary.lastMessage.type === 'IMAGE') return 'Photo';
  if (summary.lastMessage.type === 'UNSENT') return 'Message unsent';
  return summary.lastMessage.preview;
}

function EventChatRow({ summary, onOpen }: { summary: EventChatSummary; onOpen: () => void }): ReactElement {
  const theme = useResolvedTheme();
  const unreadLabel: string = summary.unreadCount > 0 ? `, ${summary.unreadCount} unread` : '';
  const preview: string = getSummaryPreview(summary);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${summary.title} event chat${unreadLabel}`}
      onPress={onOpen}
      className="active:opacity-70"
    >
      <Card className="mb-sm flex-row items-center">
        <View className="mr-sm">
          <Avatar name={summary.title} size="sm" />
        </View>
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center justify-between gap-sm">
            <Text className="min-w-0 flex-1 font-inter-semibold text-body-lg" numberOfLines={1}>
              {summary.title}
            </Text>
            {summary.lastMessage && (
              <Text className="text-label-sm text-muted-foreground">{formatChatTime(summary.lastMessage.sentAt)}</Text>
            )}
          </View>
          <Text className="mt-xs min-w-0 flex-1 text-body-md text-muted-foreground" numberOfLines={2}>
            {preview}
          </Text>
        </View>
        {summary.unreadCount > 0 && (
          <View className="ml-sm min-w-7 items-center rounded-full bg-primary px-sm py-xs">
            <Text className="font-inter-semibold text-label-sm text-primary-foreground">
              {summary.unreadCount > 99 ? '99+' : String(summary.unreadCount)}
            </Text>
          </View>
        )}
        <MessageCircle className="ml-sm" size={16} color={Colors[theme].primary} />
      </Card>
    </Pressable>
  );
}

/**
 * Renders the Event Chat list without fabricating rows or prefetching history.
 *
 * @param props - Server summaries and route-owned callbacks
 * @returns Loading, error, empty, or server-ordered chat list
 */
export function EventChatListView({
  summaries,
  isLoading,
  error,
  isRefreshing,
  onRefresh,
  onRetry,
  onLoadMore,
  hasNextPage,
  isFetchingNextPage,
  onOpen,
}: EventChatListViewProps): ReactElement {
  const theme = useResolvedTheme();
  const insets = useSafeAreaInsets();
  if (isLoading && summaries.length === 0) return <Loading message="Loading event chats" />;
  if (error && summaries.length === 0) return <ErrorView error={error} onRetry={(): void => void onRetry()} />;
  if (summaries.length === 0) return <Empty message="No event chats yet." />;

  return (
    <View className="flex-1 bg-background px-md" style={{ paddingTop: insets.top + Spacing.md }}>
      <View className="mb-md flex-row items-center">
        <MessageCircle size={22} color={Colors[theme].primary} />
        <Text className="ml-sm font-inter-bold text-headline-md">Event Chat</Text>
      </View>
      <FlatList
        data={summaries}
        keyExtractor={(summary: EventChatSummary): string => summary.conversationId}
        renderItem={({ item }: { item: EventChatSummary }): ReactElement => (
          <EventChatRow summary={item} onOpen={(): void => onOpen(item)} />
        )}
        onRefresh={(): void => {
          void onRefresh();
        }}
        refreshing={isRefreshing}
        onEndReached={(): void => {
          if (hasNextPage && !isFetchingNextPage) void onLoadMore();
        }}
        onEndReachedThreshold={0.5}
        contentContainerStyle={{ paddingBottom: insets.bottom + BAR_HEIGHT + Spacing.md }}
      />
    </View>
  );
}
