import { Image } from 'expo-image';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Building2, Check } from 'lucide-react-native';
import { type ReactElement, useCallback, useState } from 'react';
import { Linking, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { ErrorView } from '@/components/common/Error';
import { Loading } from '@/components/common/Loading';
import { Text } from '@/components/common/Text';
import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { Routes } from '@/constants/routes';
import { Colors, Spacing } from '@/constants/theme';
import { useBusinessDetailQuery } from '@/hooks/queries/useBusinessesQuery';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import { useAuthStore } from '@/store/auth.store';
import { showToast } from '@/store/toast.store';
import { businessEmailUrl, businessWebsiteUrl } from '@/utils/business-profile';
import { getQueryFailure } from '@/utils/query-failure';

/** Displays the authenticated Business identity reached from an event's Hosted by card.
 * @returns Organization profile with independent loading, retry, and back navigation
 */
export default function BusinessProfileScreen(): ReactElement {
  const { 'business-id': businessId } = useLocalSearchParams<{ 'business-id': string }>();
  const query = useBusinessDetailQuery(businessId);
  const token: string | null = useAuthStore((state): string | null => state.token);
  const router = useRouter();
  const theme = useResolvedTheme();
  const insets = useSafeAreaInsets();
  const [failedCover, setFailedCover] = useState<string | null>(null);
  const refetch = query.refetch;
  useFocusEffect(
    useCallback((): void => {
      if (token && businessId) void refetch();
    }, [token, businessId, refetch]),
  );
  const header: ReactElement = (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: true }} />
      <ScreenHeader
        title="Organization"
        backHint="Returns to the event"
        onBack={(): void => {
          if (router.canGoBack()) router.back();
          else router.replace(Routes.app.home);
        }}
      />
    </>
  );
  const business = query.data;
  const website: string | null = businessWebsiteUrl(business?.websiteUrl);
  const email: string | null = businessEmailUrl(business?.publicContactEmail);

  async function openLink(url: string): Promise<void> {
    try {
      await Linking.openURL(url);
    } catch {
      showToast('error', 'Unable to open this link. Please try again.');
    }
  }
  if (query.isLoading)
    return (
      <View className="flex-1 bg-background">
        {header}
        <Loading />
      </View>
    );
  const failure: Error | null = getQueryFailure(query);
  if (failure || !business)
    return (
      <View className="flex-1 bg-background">
        {header}
        <ErrorView
          error={failure ?? new Error('Organization not found')}
          onRetry={(): void => {
            if (token && businessId) void refetch();
          }}
        />
      </View>
    );
  return (
    <View className="flex-1 bg-background">
      {header}
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={(): void => {
              if (token) void refetch();
            }}
            tintColor={Colors[theme].foreground}
          />
        }
      >
        <View className="w-full max-w-3xl self-center">
          {business.coverImage && failedCover !== business.coverImage ? (
            <Image
              source={{ uri: business.coverImage }}
              style={{ width: '100%', aspectRatio: 2 }}
              contentFit="cover"
              accessibilityLabel={`${business.name} cover`}
              onError={(): void => setFailedCover(business.coverImage ?? null)}
            />
          ) : (
            <View className="items-center justify-center bg-muted py-xl">
              <Building2 size={48} color={Colors[theme]['muted-foreground']} />
            </View>
          )}
          <View className="gap-lg p-lg">
            <View className="gap-sm">
              <Avatar src={business.displayPicture} name={business.name} size="lg" />
              <Text accessibilityRole="header" className="text-headline-lg">
                {business.name}
              </Text>
              {business.verificationStatus === 'ACTIVE' && (
                <View className="flex-row items-center gap-1 self-start rounded-full bg-info px-sm py-xs">
                  <Check size={14} strokeWidth={2.5} color={Colors[theme]['info-foreground']} />
                  <Text className="text-label-md text-info-foreground">Verified</Text>
                </View>
              )}
            </View>
            <View className="gap-sm">
              <Text accessibilityRole="header" className="font-inter-semibold text-headline-sm">
                About
              </Text>
              <Text className="text-body-lg">
                {business.bio?.trim() || 'This organization has not added a description yet.'}
              </Text>
            </View>
            {business.address?.trim() && (
              <View className="gap-sm">
                <Text accessibilityRole="header" className="font-inter-semibold text-headline-sm">
                  Organization location
                </Text>
                <Text className="text-body-lg">{business.address}</Text>
              </View>
            )}
            {(website || email) && (
              <View className="gap-sm">
                {website && (
                  <Button
                    variant="outline"
                    onPress={(): void => void openLink(website)}
                    accessibilityHint="Opens the organization's website in your browser"
                  >
                    Visit website
                  </Button>
                )}
                {email && (
                  <Button
                    variant="outline"
                    onPress={(): void => void openLink(email)}
                    accessibilityHint="Opens your email app with the organization's published contact address"
                  >
                    Email organization
                  </Button>
                )}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
