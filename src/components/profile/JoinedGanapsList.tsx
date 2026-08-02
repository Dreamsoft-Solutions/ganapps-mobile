import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { FlatList, type ListRenderItemInfo, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Empty } from '@/components/common/Empty';
import { ErrorView } from '@/components/common/Error';
import { Loading } from '@/components/common/Loading';
import { Routes } from '@/constants/routes';
import { useJoinedGanaps } from '@/hooks/useJoinedGanaps';
import type { JoinedGanap } from '@/types/profile.types';
import { JoinedGanapCard } from './JoinedGanapCard';

const JOINED_PAGE_SIZE: number = 20;

/**
 * Full list of Ganaps joined by the current User.
 *
 * @returns The paginated joined Ganap list.
 */
export function JoinedGanapsList(): ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const joinedGanaps = useJoinedGanaps(JOINED_PAGE_SIZE);

  if (joinedGanaps.isLoading) return <Loading message="Loading joined events..." />;
  if (joinedGanaps.error) {
    return <ErrorView error={joinedGanaps.error} onRetry={(): void => void joinedGanaps.refetch()} />;
  }
  if (joinedGanaps.items.length === 0) return <Empty message="You have not joined any events yet." />;

  return (
    <View className="flex-1 bg-background px-md">
      <FlatList
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
        ListFooterComponent={joinedGanaps.isFetchingNextPage ? <Loading /> : <View className="h-8" />}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
      />
    </View>
  );
}
