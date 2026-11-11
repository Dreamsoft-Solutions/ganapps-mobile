import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { Alert, ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { FriendSettingsUpdate } from '@/api/endpoints/friends';
import { Card } from '@/components/common/Card';
import { ErrorView } from '@/components/common/Error';
import { Loading } from '@/components/common/Loading';
import { Text } from '@/components/common/Text';
import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { Colors } from '@/constants/theme';
import { useUpdateFriendSettingsMutation } from '@/hooks/mutations/useFriendsMutation';
import { useFriendSettingsQuery } from '@/hooks/queries/useFriendsQuery';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import type { FriendSettings } from '@/types/friends.types';
import { getFriendErrorMessage } from '@/utils/friends';
import { getQueryFailure } from '@/utils/query-failure';

/** One privacy setting row rendered by the Friend settings screen. */
function PrivacySettingRow({
  label,
  description,
  value,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled: boolean;
}): ReactElement {
  const theme = useResolvedTheme();
  return (
    <View className="flex-row items-center border-b border-border py-md last:border-b-0">
      <View className="mr-md min-w-0 flex-1">
        <Text className="font-inter-semibold text-body-lg">{label}</Text>
        <Text className="mt-xs text-body-md text-muted-foreground">{description}</Text>
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ false: Colors[theme].muted, true: Colors[theme].primary }}
        thumbColor={Colors[theme]['primary-foreground']}
      />
    </View>
  );
}

/**
 * Controls global Friend presence and Going visibility.
 *
 * The server remains authoritative; toggling only updates the returned
 * settings and invalidates dependent Friends projections.
 *
 * @returns Safe-area privacy settings screen
 */
export default function FriendSettingsScreen(): ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const query = useFriendSettingsQuery();
  const mutation = useUpdateFriendSettingsMutation();

  const update = (input: FriendSettingsUpdate): void => {
    void mutation.mutateAsync(input).catch((error: unknown): void => {
      const normalized: Error = error instanceof Error ? error : new Error('Unable to update privacy settings.');
      Alert.alert('Privacy settings', getFriendErrorMessage(normalized, 'Unable to update privacy settings.'));
    });
  };

  const header: ReactElement = (
    <ScreenHeader title="Friends privacy" onBack={(): void => router.back()} backHint="Returns to Friends" />
  );
  const failure: Error | null = getQueryFailure(query);
  let fallback: ReactElement | null = null;
  if (query.isLoading) fallback = <Loading message="Loading privacy settings" />;
  else if (failure) fallback = <ErrorView error={failure} onRetry={(): void => void query.refetch()} />;
  else if (!query.data) fallback = <ErrorView error={new Error('Privacy settings unavailable')} />;
  if (fallback || !query.data) {
    return (
      <View className="flex-1 bg-background">
        {header}
        {fallback}
      </View>
    );
  }

  const settings: FriendSettings = query.data;
  return (
    <View className="flex-1 bg-background">
      {header}
      <ScrollView
        className="flex-1 px-md"
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="mb-lg text-body-md text-muted-foreground">
          Choose what your friends can see. These settings apply to all your friends.
        </Text>
        <Card>
          <PrivacySettingRow
            label="Show active status to friends"
            description="Let friends see when you're active in the app."
            value={settings.presenceVisibleToFriends}
            disabled={mutation.isPending}
            onChange={(value: boolean): void => update({ presenceVisibleToFriends: value })}
          />
          <PrivacySettingRow
            label="Show Going events to friends"
            description="Let friends see the upcoming and ongoing events you're going to."
            value={settings.goingVisibleToFriends}
            disabled={mutation.isPending}
            onChange={(value: boolean): void => update({ goingVisibleToFriends: value })}
          />
        </Card>
        {mutation.error && (
          <Text accessibilityLiveRegion="polite" className="mt-md text-body-md text-destructive">
            {getFriendErrorMessage(mutation.error, 'Unable to update privacy settings.')}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}
