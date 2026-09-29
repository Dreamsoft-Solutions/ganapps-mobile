import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Ban, MessageCircle, UserMinus } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { ErrorView } from '@/components/common/Error';
import { IconButton } from '@/components/common/IconButton';
import { Loading } from '@/components/common/Loading';
import { Text } from '@/components/common/Text';
import { formatInterestLabel } from '@/constants/interests';
import { Routes } from '@/constants/routes';
import { useUnfriendMutation } from '@/hooks/mutations/useFriendsMutation';
import { useBlockUserMutation } from '@/hooks/mutations/useModerationMutation';
import { useFriendProfileQuery } from '@/hooks/queries/useFriendsQuery';
import { showToast } from '@/store/toast.store';
import type { FriendGoingItem } from '@/types/friends.types';
import { getFriendErrorMessage } from '@/utils/friends';

/** Reads a single dynamic route parameter without trusting array-shaped deep-link input. */
function getUserId(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

/** Formats an optional server-owned Going timestamp for local display. */
function formatGoingDate(value: string): string {
  const date: Date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * Relationship-scoped safe Friend profile.
 *
 * The server decides which optional fields and actions are available; this
 * screen renders no email, provider identifier, attendance detail, or exact
 * location data.
 *
 * @returns Safe Friend profile with messaging, unfriend, and block actions
 */
export default function FriendProfileScreen(): ReactElement {
  const router = useRouter();
  const params = useLocalSearchParams<{ 'user-id'?: string | string[] }>();
  const insets = useSafeAreaInsets();
  const userId: string = getUserId(params['user-id']);
  const profileQuery = useFriendProfileQuery(userId);
  const unfriendMutation = useUnfriendMutation();
  const blockMutation = useBlockUserMutation();

  const handleUnfriend = (): void => {
    if (!profileQuery.data) return;
    Alert.alert(
      'Unfriend user',
      `Remove ${profileQuery.data.displayName} from your Friends list? Existing Direct history remains server-authorized.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unfriend',
          style: 'destructive',
          onPress: (): void => {
            void unfriendMutation
              .mutateAsync(userId)
              .then((): void => {
                showToast('success', 'Friendship ended.');
                router.back();
              })
              .catch((error: unknown): void => {
                const normalized: Error = error instanceof Error ? error : new Error('Unable to unfriend this user.');
                showToast('error', getFriendErrorMessage(normalized, 'Unable to unfriend this user.'));
              });
          },
        },
      ],
    );
  };

  const handleBlock = (): void => {
    if (!profileQuery.data) return;
    Alert.alert(
      'Block user',
      `Blocking ${profileQuery.data.displayName} ends the Friendship. Unblocking will not restore it or a pending request.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block user',
          style: 'destructive',
          onPress: (): void => {
            void blockMutation
              .mutateAsync({ userId })
              .then((): void => {
                showToast('success', 'User blocked.');
                router.back();
              })
              .catch((error: unknown): void => {
                const normalized: Error = error instanceof Error ? error : new Error('Unable to block this user.');
                showToast('error', getFriendErrorMessage(normalized, 'Unable to block this user.'));
              });
          },
        },
      ],
    );
  };

  const handleMessage = (): void => {
    if (!profileQuery.data) return;
    router.push(Routes.directChatForFriend(profileQuery.data));
  };

  const header: ReactElement = (
    <View className="mb-md flex-row items-center">
      <IconButton
        accessibilityLabel="Go back"
        accessibilityHint="Returns to Friends"
        onPress={(): void => router.back()}
      >
        <ArrowLeft size={20} />
      </IconButton>
      <Text className="ml-sm font-inter-bold text-headline-md" accessibilityRole="header">
        Friend profile
      </Text>
    </View>
  );

  if (profileQuery.isLoading || profileQuery.error || !profileQuery.data) {
    const content: ReactElement = profileQuery.isLoading ? (
      <Loading message="Loading profile" />
    ) : profileQuery.error ? (
      <ErrorView error={profileQuery.error} onRetry={(): void => void profileQuery.refetch()} />
    ) : (
      <ErrorView error={new Error('Profile unavailable')} />
    );
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <View className="px-md">{header}</View>
        {content}
      </SafeAreaView>
    );
  }

  const profile = profileQuery.data;
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView
        className="flex-1 px-md"
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        showsVerticalScrollIndicator={false}
      >
        {header}
        <Card>
          <View className="items-center">
            <Avatar src={profile.displayPicture} name={profile.displayName} size="lg" />
            <Text className="mt-md text-headline-md" numberOfLines={2}>
              {profile.displayName}
            </Text>
            <Text className="mt-xs text-body-md text-muted-foreground">@{profile.username}</Text>
          </View>
          {profile.bio !== undefined && (
            <Text className="mt-lg text-center text-body-md text-muted-foreground">
              {profile.bio?.trim() || 'No bio yet.'}
            </Text>
          )}
          {profile.interests !== undefined && (
            <View className="mt-lg">
              <Text className="mb-sm text-label-md uppercase tracking-widest text-muted-foreground">Interests</Text>
              {profile.interests.length > 0 ? (
                <View className="flex-row flex-wrap gap-2">
                  {profile.interests.map(
                    (interest: string): ReactElement => (
                      <View key={interest} className="rounded-full border border-border bg-background px-sm py-xs">
                        <Text className="text-label-sm">{formatInterestLabel(interest)}</Text>
                      </View>
                    ),
                  )}
                </View>
              ) : (
                <Text className="text-body-md text-muted-foreground">No interests shared.</Text>
              )}
            </View>
          )}
        </Card>
        {profile.going !== undefined && (
          <View className="mt-lg">
            <Text className="mb-sm font-inter-semibold text-headline-sm">Going</Text>
            {profile.going.length === 0 ? (
              <Text className="text-body-md text-muted-foreground">No upcoming or ongoing Ganaps shared.</Text>
            ) : (
              profile.going.map(
                (item: FriendGoingItem): ReactElement => (
                  <Card key={item.ganapId} className="mb-sm">
                    <Text className="font-inter-semibold text-body-lg">{item.title}</Text>
                    <Text className="mt-xs text-body-md text-muted-foreground">{formatGoingDate(item.startDate)}</Text>
                    <Text className="mt-xs text-label-md text-primary">{item.status}</Text>
                  </Card>
                ),
              )
            )}
          </View>
        )}
        <View className="mt-lg gap-sm">
          <Button onPress={handleMessage} leftIcon={<MessageCircle size={17} />}>
            Message
          </Button>
          <Button
            variant="outline"
            onPress={handleUnfriend}
            loading={unfriendMutation.isPending}
            disabled={unfriendMutation.isPending || blockMutation.isPending}
            leftIcon={<UserMinus size={17} />}
          >
            Unfriend
          </Button>
          <Button
            variant="destructive"
            onPress={handleBlock}
            loading={blockMutation.isPending}
            disabled={unfriendMutation.isPending || blockMutation.isPending}
            leftIcon={<Ban size={17} />}
          >
            Block user
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
