import type { LucideIcon } from 'lucide-react-native';
import { Check, Monitor, Moon, Sun } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { Empty } from '@/components/common/Empty';
import { ErrorView } from '@/components/common/Error';
import { Loading } from '@/components/common/Loading';
import { Text } from '@/components/common/Text';
import { useUnblockUserMutation } from '@/hooks/mutations/useModerationMutation';
import { useBlockedUsersQuery } from '@/hooks/queries/useModerationQuery';
import { type ThemeMode, useThemeStore } from '@/store/theme.store';
import { showToast } from '@/store/toast.store';
import type { BlockedUserSummary } from '@/types/moderation.types';
import { getModerationErrorMessage } from '@/utils/moderation';

interface ThemeOption {
  mode: ThemeMode;
  label: string;
  icon: LucideIcon;
}

const THEME_OPTIONS: ThemeOption[] = [
  { mode: 'light', label: 'Light', icon: Sun },
  { mode: 'dark', label: 'Dark', icon: Moon },
  { mode: 'system', label: 'System', icon: Monitor },
];

export default function SettingsScreen(): ReactElement {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const blockedUsersQuery = useBlockedUsersQuery();
  const unblockMutation = useUnblockUserMutation();

  async function handleUnblock(userId: string, username: string): Promise<void> {
    await unblockMutation.mutateAsync({ userId });
    showToast('success', `Unblocked user ${username}.`);
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="p-md">
      <Text className="text-headline-md mb-md" accessibilityRole="header">
        Settings
      </Text>
      <Text className="text-label-md text-muted-foreground mb-xs">Theme</Text>
      <View className="gap-sm">
        {THEME_OPTIONS.map((option: ThemeOption): ReactElement => {
          const isActive = option.mode === mode;
          const Icon = option.icon;
          return (
            <Pressable
              key={option.mode}
              onPress={(): void => {
                void setMode(option.mode);
              }}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ selected: isActive }}
              className={`flex-row items-center rounded-md border p-md ${
                isActive ? 'border-primary bg-muted' : 'border-border bg-card'
              }`}
            >
              <Icon size={20} className={isActive ? 'text-primary' : 'text-muted-foreground'} />
              <Text className="text-body-md ml-sm flex-1">{option.label}</Text>
              {isActive && <Check size={20} className="text-primary" />}
            </Pressable>
          );
        })}
      </View>

      <View className="mt-xl">
        <Text className="mb-sm font-inter-semibold text-headline-sm" accessibilityRole="header">
          Blocked users
        </Text>
        {blockedUsersQuery.isLoading && blockedUsersQuery.blockedUsers.length === 0 ? (
          <View className="h-32">
            <Loading message="Loading blocked users" />
          </View>
        ) : blockedUsersQuery.error && blockedUsersQuery.blockedUsers.length === 0 ? (
          <View className="h-48">
            <ErrorView error={blockedUsersQuery.error} onRetry={(): void => void blockedUsersQuery.refetch()} />
          </View>
        ) : blockedUsersQuery.blockedUsers.length === 0 ? (
          <View className="min-h-32">
            <Empty message="You have not blocked anyone." />
          </View>
        ) : (
          <View className="gap-sm">
            {blockedUsersQuery.blockedUsers.map(
              (blockedUser: BlockedUserSummary): ReactElement => (
                <View
                  key={blockedUser.userId}
                  className="flex-row items-center rounded-xl border border-border bg-card p-md"
                >
                  <Avatar src={blockedUser.displayPicture} name={blockedUser.displayName} size="sm" />
                  <View className="ml-sm min-w-0 flex-1">
                    <Text className="font-inter-semibold text-body-lg" numberOfLines={1}>
                      {blockedUser.displayName}
                    </Text>
                    <Text className="text-body-md text-muted-foreground" numberOfLines={1}>
                      @{blockedUser.username}
                    </Text>
                  </View>
                  <Button
                    variant="outline"
                    size="sm"
                    loading={unblockMutation.isPending && unblockMutation.variables?.userId === blockedUser.userId}
                    disabled={unblockMutation.isPending}
                    accessibilityHint="Removes this directional block"
                    onPress={(): Promise<void> => handleUnblock(blockedUser.userId, blockedUser.username)}
                  >
                    {`Unblock user ${blockedUser.username}`}
                  </Button>
                </View>
              ),
            )}
            {blockedUsersQuery.error && (
              <Text className="text-body-md text-destructive">Unable to refresh blocked users.</Text>
            )}
            {blockedUsersQuery.hasNextPage && (
              <Button
                variant="outline"
                loading={blockedUsersQuery.isFetchingNextPage}
                disabled={blockedUsersQuery.isFetchingNextPage}
                onPress={(): Promise<void> => blockedUsersQuery.fetchNextPage().then((): undefined => undefined)}
              >
                Load more blocked users
              </Button>
            )}
          </View>
        )}
        {unblockMutation.error && (
          <Text accessibilityLiveRegion="polite" className="mt-sm text-body-md text-destructive">
            {getModerationErrorMessage(unblockMutation.error, 'Unable to unblock this user.')}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}
