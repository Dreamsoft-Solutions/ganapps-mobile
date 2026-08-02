import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { FlatList, type ListRenderItemInfo, Pressable, View } from 'react-native';
import { Card } from '@/components/common/Card';
import { Empty } from '@/components/common/Empty';
import { ErrorView } from '@/components/common/Error';
import { Loading } from '@/components/common/Loading';
import { Text } from '@/components/common/Text';
import { Routes } from '@/constants/routes';
import { useGanaps } from '@/hooks/useGanaps';
import type { GanapListItem } from '@/types/ganap.types';

/**
 * Formats a Ganap's start date for a list row.
 *
 * @param iso - ISO 8601 start date from the server
 * @returns A short human-readable date and time
 */
function formatStart(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * The scrolling list of published events.
 *
 * Covers loading, error and empty states, and pages by cursor as the student
 * scrolls.
 *
 * @returns The list element
 */
export function GanapList(): ReactElement {
  const router = useRouter();
  const { items, isLoading, error, hasNextPage, fetchNextPage, isFetchingNextPage } = useGanaps();

  if (isLoading) return <Loading />;
  if (error) return <ErrorView error={error} />;
  if (items.length === 0) return <Empty message="No events yet. Check back soon." />;

  return (
    <FlatList
      data={items}
      keyExtractor={(item: GanapListItem): string => item.id}
      renderItem={({ item }: ListRenderItemInfo<GanapListItem>): ReactElement => (
        <Pressable onPress={(): void => router.push(Routes.ganapDetail(item.id))}>
          <Card className="mb-sm">
            <Text className="text-headline-sm">{item.title}</Text>
            <Text className="text-muted-foreground text-label-md mt-1">{item.businessName}</Text>
            <Text className="text-muted-foreground text-body-md mt-1">{formatStart(item.startDate)}</Text>
          </Card>
        </Pressable>
      )}
      onEndReached={(): void => {
        if (hasNextPage && !isFetchingNextPage) fetchNextPage();
      }}
      onEndReachedThreshold={0.5}
      ListFooterComponent={isFetchingNextPage ? <Loading /> : <View className="h-8" />}
    />
  );
}
