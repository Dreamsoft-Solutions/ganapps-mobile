import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/common/Button';
import { ErrorView } from '@/components/common/Error';
import { Loading } from '@/components/common/Loading';
import { Text } from '@/components/common/Text';
import { Routes } from '@/constants/routes';
import { usePublicBusinessQuery } from '@/hooks/queries/useBusinessesQuery';
import { useAuthStore } from '@/store/auth.store';
import type { ParsedApiError } from '@/utils/error-handling';
import { isValidBusinessShareSlug } from '@/utils/share-links';

/**
 * Opens a Business profile from a shared Business URL.
 *
 * Resolves the slug through the public API, then forwards to the profile by id. Every
 * 404 shows one unavailable state, so a missing and a removed Business look the same.
 *
 * @returns A loading screen while the slug resolves, or an unavailable or error state.
 */
export default function BusinessShareRoute(): ReactElement {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug?: string | string[] }>();
  const token = useAuthStore((state) => state.token);
  const validSlug: string | undefined = typeof slug === 'string' && isValidBusinessShareSlug(slug) ? slug : undefined;
  const query = usePublicBusinessQuery(validSlug);
  const profileId: string | undefined = query.data?.id;

  useEffect((): void => {
    if (validSlug === undefined) {
      router.replace(token === null ? Routes.public.welcome : Routes.app.home);
      return;
    }
    if (token === null) {
      router.replace(Routes.auth.loginForBusinessShare(validSlug));
      return;
    }
    if (profileId !== undefined) router.replace(Routes.businessProfile(profileId));
  }, [validSlug, token, profileId, router]);

  if (query.error !== null && (query.error as ParsedApiError).status === 404) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-xl">
        <Text className="mb-sm text-center font-allo-semibold text-headline-sm" accessibilityRole="header">
          This Business is not available
        </Text>
        <Text className="mb-lg text-center text-body-md text-muted-foreground">
          The link may be old, or the Business is no longer on Ganapps.
        </Text>
        <Button variant="outline" onPress={(): void => router.replace(Routes.app.home)}>
          Go to Ganapps
        </Button>
      </View>
    );
  }
  if (query.error !== null) return <ErrorView error={query.error} onRetry={(): void => void query.refetch()} />;
  return <Loading message="Opening organization" />;
}
