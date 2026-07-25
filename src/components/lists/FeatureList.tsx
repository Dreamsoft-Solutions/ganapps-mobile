import type { ReactElement } from 'react';
import { FlatList, type ListRenderItemInfo, View } from 'react-native';
import { Card } from '@/components/common/Card';
import { Empty } from '@/components/common/Empty';
import { ErrorView } from '@/components/common/Error';
import { Loading } from '@/components/common/Loading';
import { Text } from '@/components/common/Text';
import { useFeatures } from '@/hooks/useFeatures';
import type { Feature } from '@/types/feature.types';

export function FeatureList(): ReactElement {
  const { items, isLoading, error, hasNextPage, fetchNextPage, isFetchingNextPage } = useFeatures();

  if (isLoading) return <Loading />;
  if (error) return <ErrorView error={error} />;
  if (items.length === 0) return <Empty message="No features found" />;

  return (
    <FlatList
      data={items}
      keyExtractor={(item: Feature): string => item.id}
      renderItem={({ item }: ListRenderItemInfo<Feature>): ReactElement => (
        <Card className="mb-3">
          <Text className="text-headline-sm">{item.name}</Text>
          {item.description && <Text className="text-lynx-on-surface-variant mt-1">{item.description}</Text>}
        </Card>
      )}
      onEndReached={(): void => {
        if (hasNextPage) fetchNextPage();
      }}
      onEndReachedThreshold={0.5}
      ListFooterComponent={isFetchingNextPage ? <Loading /> : <View className="h-8" />}
    />
  );
}
