import type { ReactElement } from 'react';
import { View } from 'react-native';
import { Button } from './Button';
import { Text } from './Text';

interface ErrorViewProps {
  error: Error | null;
  onRetry?: () => void;
}

/**
 * Full-screen error view with an optional retry action.
 *
 * @param props - Error object and optional retry callback.
 * @returns A centered error message with a retry button when available.
 */
export function ErrorView({ error, onRetry }: ErrorViewProps): ReactElement {
  return (
    <View className="flex-1 items-center justify-center p-xl">
      <Text className="text-destructive text-headline-sm mb-sm">Something went wrong</Text>
      <Text className="text-muted-foreground text-body-md text-center mb-lg">
        {error?.message || 'An unexpected error occurred'}
      </Text>
      {onRetry && (
        <Button onPress={onRetry} variant="outline">
          Try Again
        </Button>
      )}
    </View>
  );
}
