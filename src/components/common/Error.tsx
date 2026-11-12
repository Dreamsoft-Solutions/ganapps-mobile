import type { ReactElement } from 'react';
import { View } from 'react-native';
import { isNetworkFailure, NETWORK_LOAD_MESSAGE } from '@/utils/query-failure';
import { Button } from './Button';
import { Text } from './Text';

interface ErrorViewProps {
  error: Error | null;
  onRetry?: () => void;
}

/**
 * Full-screen error view with an optional retry action.
 *
 * A request that got no response shows {@link NETWORK_LOAD_MESSAGE} rather than
 * Axios's bare "Network Error".
 *
 * @param props - Error object and optional retry callback.
 * @returns A centered error message with a retry button when available.
 */
export function ErrorView({ error, onRetry }: ErrorViewProps): ReactElement {
  return (
    <View className="flex-1 items-center justify-center p-xl">
      <Text
        className="mb-sm text-center font-inter-semibold text-headline-sm text-foreground"
        accessibilityRole="header"
      >
        Something went wrong
      </Text>
      <Text className="text-muted-foreground text-body-md text-center mb-lg">
        {error && isNetworkFailure(error) ? NETWORK_LOAD_MESSAGE : error?.message || 'An unexpected error occurred'}
      </Text>
      {onRetry && (
        <Button onPress={onRetry} variant="outline">
          Try again
        </Button>
      )}
    </View>
  );
}
