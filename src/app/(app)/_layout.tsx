import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import type { Href } from 'expo-router';
import { Tabs, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { Loading } from '@/components/common/Loading';
import { AppTabBar, BAR_HEIGHT } from '@/components/navigation/AppTabBar';
import { Routes } from '@/constants/routes';
import { useAuthQuery } from '@/hooks/queries/useAuthQuery';
import { chatQueryKeys, useChatSummariesQuery } from '@/hooks/queries/useChatQuery';
import { type ChatConnectionState, chatSocketClient } from '@/services/chat-socket.service';
import { startFriendPresenceHeartbeat } from '@/services/friend-presence.service';
import {
  completePendingNotification,
  getPendingNotificationTarget,
  startAndroidPushTokenSync,
  subscribeToPendingNotification,
} from '@/services/push-notification.service';
import { useAuthStore } from '@/store/auth.store';
import { shouldHideAppTabBar } from '@/utils/navigation';
import { needsOnboarding } from '@/utils/onboarding';

/**
 * Authenticated app shell with a custom bottom tab navigator.
 *
 * @returns The tab navigator or a loading state.
 */
export default function AppLayout(): ReactElement {
  const queryClient: QueryClient = useQueryClient();
  const router = useRouter();
  const segments = useSegments();
  const rootNavigationState = useRootNavigationState();
  const { data: user, isLoading } = useAuthQuery();
  const setUser = useAuthStore((s) => s.setUser);
  const hideTabBar: boolean = shouldHideAppTabBar(segments);
  const [pendingNotificationTarget, setPendingNotificationTarget] = useState<Href | null>((): Href | null =>
    getPendingNotificationTarget(),
  );
  const isRouterReady: boolean = Boolean(rootNavigationState?.key);
  const isVerifiedUserReady: boolean = user?.isVerified === true;
  const isNotificationReady: boolean = isVerifiedUserReady && !needsOnboarding(user ?? null);
  const { hasUnreadMessages } = useChatSummariesQuery(isNotificationReady);

  useEffect((): (() => void) | undefined => {
    if (!isNotificationReady) return undefined;
    const invalidateSummaries = (): void => {
      void queryClient.invalidateQueries({ queryKey: chatQueryKeys.summaries(), refetchType: 'active' });
    };
    const unsubscribeSummary = chatSocketClient.onSummaryChange((): void => {
      invalidateSummaries();
    });
    const unsubscribeConnection = chatSocketClient.onConnectionStateChange((state: ChatConnectionState): void => {
      if (state === 'connected') invalidateSummaries();
    });
    const appStateSubscription = AppState.addEventListener('change', (state: AppStateStatus): void => {
      if (state !== 'active') return;
      invalidateSummaries();
      void chatSocketClient.ensureConnected();
    });
    return (): void => {
      unsubscribeSummary();
      unsubscribeConnection();
      appStateSubscription.remove();
    };
  }, [isNotificationReady, queryClient]);

  useEffect(() => {
    if (!user) return;

    setUser(user);

    // This layout stays mounted underneath the full-screen onboarding and verify-email
    // modals, so its effect re-runs whenever the user object changes — including right
    // after step 1 saves. Re-issuing `replace` for the screen already on top would remount
    // the onboarding form and throw away its step state, so bail when we are already there.
    const isOnModal = segments.some((s: string): boolean => s === 'verify-email' || s === 'onboarding');
    if (isOnModal) return;

    if (!user.isVerified) {
      router.replace(Routes.verifyEmail);
    } else if (needsOnboarding(user)) {
      router.replace(Routes.onboarding);
    }
  }, [user, segments, router, setUser]);

  useEffect((): (() => void) => {
    return subscribeToPendingNotification((target: Href | null): void => {
      setPendingNotificationTarget(target);
    });
  }, []);

  useEffect((): void => {
    if (!isNotificationReady || !isRouterReady) return;

    const target = pendingNotificationTarget;
    if (target === null) return;

    try {
      router.push(target);
      completePendingNotification(target);
    } catch {
      // Keep the target queued so a later router-ready render can retry it.
    }
  }, [isNotificationReady, isRouterReady, pendingNotificationTarget, router]);

  useEffect((): (() => void) | undefined => {
    if (!isVerifiedUserReady || user?.id === undefined) return undefined;
    return startAndroidPushTokenSync();
  }, [isVerifiedUserReady, user?.id]);

  useEffect((): (() => void) | undefined => {
    if (!isVerifiedUserReady || user?.id === undefined) return undefined;
    return startFriendPresenceHeartbeat();
  }, [isVerifiedUserReady, user?.id]);

  if (isLoading) {
    return <Loading message="Loading..." />;
  }

  return (
    <Tabs
      tabBar={(props: BottomTabBarProps): ReactElement | null =>
        hideTabBar ? null : <AppTabBar {...props} hasUnreadMessages={hasUnreadMessages} />
      }
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: BAR_HEIGHT,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          position: 'absolute',
        },
      }}
    >
      <Tabs.Screen name="(home)" />
      <Tabs.Screen name="(ganaps)" />
      <Tabs.Screen name="(chat)" />
      <Tabs.Screen name="(profile)" />
    </Tabs>
  );
}
