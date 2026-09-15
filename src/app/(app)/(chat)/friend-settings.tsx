import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { Alert, ScrollView, Switch, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { FriendSettingsUpdate } from '@/api/endpoints/friends';
import { Card } from '@/components/common/Card';
import { ErrorView } from '@/components/common/Error';
import { IconButton } from '@/components/common/IconButton';
import { Loading } from '@/components/common/Loading';
import { Text } from '@/components/common/Text';
import { Colors } from '@/constants/theme';
import { useUpdateFriendSettingsMutation } from '@/hooks/mutations/useFriendsMutation';
import { useFriendSettingsQuery } from '@/hooks/queries/useFriendsQuery';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import type { FriendSettings } from '@/types/friends.types';
import { getFriendErrorMessage } from '@/utils/friends';

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

  if (query.isLoading) return <Loading message="Loading privacy settings" />;
  if (query.error) return <ErrorView error={query.error} onRetry={(): void => void query.refetch()} />;
  if (!query.data) return <ErrorView error={new Error('Privacy settings unavailable')} />;

  const settings: FriendSettings = query.data;
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView
        className="flex-1 px-md"
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-md flex-row items-center">
          <IconButton
            accessibilityLabel="Go back"
            accessibilityHint="Returns to Friends"
            onPress={(): void => router.back()}
          >
            <ArrowLeft size={20} />
          </IconButton>
          <Text className="ml-sm font-inter-bold text-headline-md" accessibilityRole="header">
            Friends privacy
          </Text>
        </View>
        <Text className="mb-lg text-body-md text-muted-foreground">
          Choose what accepted friends can see. Changes apply globally and are enforced by the server.
        </Text>
        <Card>
          <PrivacySettingRow
            label="Show active status to friends"
            description="Allow your active status to appear in the bounded Friends carousel."
            value={settings.presenceVisibleToFriends}
            disabled={mutation.isPending}
            onChange={(value: boolean): void => update({ presenceVisibleToFriends: value })}
          />
          <PrivacySettingRow
            label="Show Going events to friends"
            description="Allow accepted friends to see your upcoming or ongoing Ganaps."
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
    </SafeAreaView>
  );
}
