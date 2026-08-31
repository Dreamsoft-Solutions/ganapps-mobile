import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { FlatList, type ListRenderItemInfo, RefreshControl, View } from 'react-native';
import { Empty } from '@/components/common/Empty';
import { ErrorView } from '@/components/common/Error';
import { Loading } from '@/components/common/Loading';
import { Routes } from '@/constants/routes';
import { useJoinedGanaps } from '@/hooks/useJoinedGanaps';
import type { JoinedGanap, JoinedGanapFilters } from '@/types/profile.types';
import { JoinedGanapCard } from './JoinedGanapCard';

const JOINED_PAGE_SIZE: number = 20;

export interface JoinedGanapsListProps {
  contentTopPadding: number;
  contentBottomPadding: number;
  filters?: JoinedGanapFilters;
}

/**
 * Full list of Ganaps joined by the current User.
 *
 * @returns The paginated joined Ganap list.
 */
export function JoinedGanapsList({
  contentTopPadding,
  contentBottomPadding,
  filters,
}: JoinedGanapsListProps): ReactElement {
  const router = useRouter();
  const joinedGanaps = useJoinedGanaps(JOINED_PAGE_SIZE, filters);
  const isDefaultUpcoming: boolean = filters?.time === 'UPCOMING' && filters.search === undefined;
  const isFilteredEmpty: boolean =
    filters?.search !== undefined || (filters?.time !== undefined && filters.time !== 'UPCOMING');
  const emptyMessage: string = isDefaultUpcoming
    ? 'No upcoming events.'
    : isFilteredEmpty
      ? 'No events match your filters.'
      : 'You have not joined any events yet.';

  if (joinedGanaps.isLoading) return <Loading message="Loading joined events..." />;
  if (joinedGanaps.error) {
    return <ErrorView error={joinedGanaps.error} onRetry={(): void => void joinedGanaps.refetch()} />;
  }

  return (
    <View className="flex-1 bg-background px-md">
      <FlatList
        testID="joined-ganaps-list"
        data={joinedGanaps.items}
        keyExtractor={(item: JoinedGanap): string => item.id}
        renderItem={({ item }: ListRenderItemInfo<JoinedGanap>): ReactElement => (
          <JoinedGanapCard
            ganap={item}
            onPress={(): void => {
              router.push(Routes.ganapDetail(item.id));
            }}
          />
        )}
        onEndReached={(): void => {
          if (joinedGanaps.hasNextPage && !joinedGanaps.isFetchingNextPage) {
            void joinedGanaps.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        onRefresh={(): void => void joinedGanaps.refetch()}
        refreshing={joinedGanaps.isRefetching && !joinedGanaps.isLoading}
        refreshControl={
          <RefreshControl
            testID="joined-ganaps-refresh-control"
            refreshing={joinedGanaps.isRefetching && !joinedGanaps.isLoading}
            onRefresh={(): void => void joinedGanaps.refetch()}
          />
        }
        ListEmptyComponent={<Empty message={emptyMessage} />}
        ListFooterComponent={
          joinedGanaps.isFetchingNextPage ? (
            <View testID="joined-ganaps-incremental-loading">
              <Loading />
            </View>
          ) : (
            <View className="h-8" />
          )
        }
        contentContainerStyle={{
          paddingTop: contentTopPadding,
          paddingBottom: contentBottomPadding,
          flexGrow: 1,
        }}
      />
    </View>
  );
}
