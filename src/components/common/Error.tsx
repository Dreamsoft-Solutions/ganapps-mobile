import { Pressable, View } from 'react-native';
import { Text } from './Text';

interface ErrorViewProps {
  error: Error | null;
  onRetry?: () => void;
}

export function ErrorView({ error, onRetry }: ErrorViewProps) {
  return (
    <View className="flex-1 items-center justify-center p-xl">
      <Text className="text-lynx-error text-headline-sm mb-sm">Something went wrong</Text>
      <Text className="text-lynx-on-surface-variant text-body-md text-center mb-lg">
        {error?.message || 'An unexpected error occurred'}
      </Text>
      {onRetry && (
        <Pressable onPress={onRetry} className="bg-lynx-primary-container px-lg py-md rounded-lg">
          <Text className="text-lynx-on-primary-container font-semibold">Try Again</Text>
        </Pressable>
      )}
    </View>
  );
}
