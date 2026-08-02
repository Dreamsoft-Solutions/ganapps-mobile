import { useRouter } from 'expo-router';
import { BadgeCheck, Edit3, LogOut, Settings } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { ErrorView } from '@/components/common/Error';
import { IconButton } from '@/components/common/IconButton';
import { Loading } from '@/components/common/Loading';
import { Text } from '@/components/common/Text';
import { JoinedGanapCard } from '@/components/profile/JoinedGanapCard';
import { formatInterestLabel } from '@/constants/interests';
import { Routes } from '@/constants/routes';
import { useAuthQuery } from '@/hooks/queries/useAuthQuery';
import { useAuth } from '@/hooks/useAuth';
import { useJoinedGanaps } from '@/hooks/useJoinedGanaps';
import type { JoinedGanap } from '@/types/profile.types';

const PROFILE_JOINED_PAGE_SIZE: number = 3;

/**
 * Current User profile tab.
 *
 * @returns The profile overview with joined Ganap activity.
 */
export default function ProfileScreen(): ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { logout, logoutMutation } = useAuth();
  const profileQuery = useAuthQuery();
  const joinedGanaps = useJoinedGanaps(PROFILE_JOINED_PAGE_SIZE);
  const user = profileQuery.data;

  if (profileQuery.isLoading) return <Loading message="Loading your profile..." />;
  if (profileQuery.error) {
    return <ErrorView error={profileQuery.error} onRetry={(): void => void profileQuery.refetch()} />;
  }
  if (!user) return <ErrorView error={new Error('Profile not found')} />;

  const displayName: string = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.username;
  const showSeeAll: boolean = joinedGanaps.hasNextPage || joinedGanaps.total > joinedGanaps.items.length;
  const joinedCount: string = joinedGanaps.isLoading || joinedGanaps.error ? '...' : String(joinedGanaps.total);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center justify-between px-md pt-md">
          <Text className="text-label-md uppercase tracking-widest text-muted-foreground">Profile</Text>
          <IconButton
            accessibilityLabel="Open settings"
            onPress={(): void => {
              router.push(Routes.profileSettings);
            }}
          >
            <Settings size={20} className="text-muted-foreground" />
          </IconButton>
        </View>

        <View className="items-center px-md pb-lg pt-lg">
          <Avatar src={user.displayPicture} name={displayName} size="lg" />
          <View className="mt-md flex-row items-center">
            <Text className="text-headline-md">{displayName}</Text>
            {user.isVerified && <BadgeCheck size={18} className="ml-2 text-primary" />}
          </View>
          <Text className="mt-1 text-body-md text-muted-foreground">@{user.username}</Text>
          <Text className="mt-1 text-body-md text-muted-foreground">{user.email}</Text>
          <Text className="mt-md max-w-80 text-center text-body-md text-muted-foreground">
            {user.bio?.trim() || 'No bio yet.'}
          </Text>
        </View>

        <View className="mx-md mb-lg items-center rounded-xl border border-border bg-card p-md">
          <Text className="text-headline-lg">{joinedCount}</Text>
          <Text className="mt-1 text-label-md uppercase tracking-widest text-muted-foreground">Joined</Text>
        </View>

        <View className="mb-lg px-md">
          <Text className="mb-sm text-label-md uppercase tracking-widest text-foreground">Interests</Text>
          {user.interests.length > 0 ? (
            <View className="flex-row flex-wrap gap-2">
              {user.interests.map(
                (interest: string): ReactElement => (
                  <View key={interest} className="rounded-full bg-primary px-sm py-xs">
                    <Text className="text-label-sm text-primary-foreground">{formatInterestLabel(interest)}</Text>
                  </View>
                ),
              )}
            </View>
          ) : (
            <Text className="text-body-md text-muted-foreground">Add interests to personalize your profile.</Text>
          )}
        </View>

        <View className="mb-lg px-md">
          <View className="mb-sm flex-row items-center justify-between">
            <Text className="text-label-md uppercase tracking-widest text-foreground">Joined Events</Text>
            {showSeeAll && (
              <Pressable
                onPress={(): void => {
                  router.push(Routes.profileJoined);
                }}
                accessibilityRole="button"
                className="active:opacity-70"
              >
                <Text className="text-body-md font-inter-semibold text-primary">See all</Text>
              </Pressable>
            )}
          </View>

          {joinedGanaps.isLoading ? (
            <View className="h-32">
              <Loading message="Loading joined events..." />
            </View>
          ) : joinedGanaps.error ? (
            <View className="h-48">
              <ErrorView error={joinedGanaps.error} onRetry={(): void => void joinedGanaps.refetch()} />
            </View>
          ) : joinedGanaps.items.length === 0 ? (
            <Text className="text-body-md text-muted-foreground">Events you join will appear here.</Text>
          ) : (
            joinedGanaps.items.map(
              (ganap: JoinedGanap): ReactElement => (
                <JoinedGanapCard
                  key={ganap.id}
                  ganap={ganap}
                  onPress={(): void => {
                    router.push(Routes.ganapDetail(ganap.id));
                  }}
                />
              ),
            )
          )}
        </View>

        <View className="gap-sm px-md">
          <Button
            onPress={(): void => {
              router.push(Routes.profileEdit);
            }}
            leftIcon={<Edit3 size={17} className="text-primary-foreground" />}
            size="lg"
          >
            Edit Profile
          </Button>
          <Button
            variant="outline"
            onPress={(): void => {
              router.push(Routes.profileSettings);
            }}
            leftIcon={<Settings size={17} className="text-foreground" />}
            size="lg"
          >
            Settings
          </Button>
          <Button
            variant="secondary"
            onPress={(): Promise<void> => logout()}
            loading={logoutMutation.isPending}
            leftIcon={<LogOut size={17} className="text-secondary-foreground" />}
            size="lg"
          >
            Sign Out
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
