import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { FlatList, type ListRenderItemInfo, RefreshControl, View } from 'react-native';
import { Empty } from '@/components/common/Empty';
import { ErrorView } from '@/components/common/Error';
import { Loading } from '@/components/common/Loading';
import { Routes } from '@/constants/routes';
import { useGanaps } from '@/hooks/useGanaps';
import { useSavedGanaps } from '@/hooks/useSavedGanaps';
import type { SavedGanap } from '@/types/profile.types';
import { SavedGanapCard } from './SavedGanapCard';

const SAVED_PAGE_SIZE: number = 20;

/** Props for {@link SavedGanapsList}. */
export interface SavedGanapsListProps {
  contentTopPadding: number;
  contentBottomPadding: number;
}

/**
 * Full list of Ganaps saved by the current User.
 *
 * The endpoint takes no filters, so this list carries no filter bar and one
 * empty message. Rows are ordered by most recently saved.
 *
 * @param props - Content insets owned by the surrounding tab chrome.
 * @returns The paginated saved Ganap list.
 */
export function SavedGanapsList({ contentTopPadding, contentBottomPadding }: SavedGanapsListProps): ReactElement {
  const router = useRouter();
  const savedGanaps = useSavedGanaps(SAVED_PAGE_SIZE);
  const { toggleSave } = useGanaps();

  if (savedGanaps.isLoading) return <Loading message="Loading saved events..." />;
  if (savedGanaps.error) {
    return <ErrorView error={savedGanaps.error} onRetry={(): void => void savedGanaps.refetch()} />;
  }

  return (
    <View className="flex-1 bg-background px-md">
      <FlatList
        testID="saved-ganaps-list"
        data={savedGanaps.items}
        keyExtractor={(item: SavedGanap): string => item.id}
        renderItem={({ item }: ListRenderItemInfo<SavedGanap>): ReactElement => (
          <SavedGanapCard
            ganap={item}
            onPress={(): void => {
              router.push(Routes.ganapDetail(item.id));
            }}
            onUnsave={(): void => {
              void toggleSave({ ganapId: item.id, isSaved: true });
            }}
          />
        )}
        onEndReached={(): void => {
          if (savedGanaps.hasNextPage && !savedGanaps.isFetchingNextPage) {
            void savedGanaps.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            testID="saved-ganaps-refresh-control"
            refreshing={savedGanaps.isRefetching && !savedGanaps.isLoading}
            onRefresh={(): void => void savedGanaps.refetch()}
          />
        }
        ListEmptyComponent={<Empty message="You have not saved any events yet." />}
        ListFooterComponent={
          savedGanaps.isFetchingNextPage ? (
            <View testID="saved-ganaps-incremental-loading">
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
