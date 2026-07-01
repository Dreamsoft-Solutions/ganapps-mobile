import { FlatList, View } from 'react-native';
import { useFeatures } from '@/hooks/useFeatures';
import { Card } from '@/components/common/Card';
import { Text } from '@/components/common/Text';
import { Loading } from '@/components/common/Loading';
import { Error } from '@/components/common/Error';
import { Empty } from '@/components/common/Empty';

export function FeatureList() {
  const {
    items,
    isLoading,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useFeatures();

  if (isLoading) return <Loading />;
  if (error) return <Error error={error} />;
  if (items.length === 0) return <Empty message="No features found" />;

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <Card className="mb-3">
          <Text className="text-headline-sm">{item.name}</Text>
          {item.description && (
            <Text className="text-lynx-on-surface-variant mt-1">
              {item.description}
            </Text>
          )}
        </Card>
      )}
      onEndReached={() => {
        if (hasNextPage) fetchNextPage();
      }}
      onEndReachedThreshold={0.5}
      ListFooterComponent={
        isFetchingNextPage ? <Loading /> : <View className="h-8" />
      }
    />
  );
}
