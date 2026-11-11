import { CloudOff, WifiOff } from 'lucide-react-native';
import { type ReactElement, useEffect } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import { Text } from '@/components/common/Text';
import { Colors } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import { type ConnectionStatus, selectConnectionStatus, useConnectionStore } from '@/store/connection.store';

/** What the banner says for each status other than `'online'`. */
export const CONNECTION_BANNER_COPY: Record<Exclude<ConnectionStatus, 'online'>, string> = {
  offline: "You're offline. Likes, saves and check-ins will sync when you reconnect.",
  unstable: 'Connection is unstable. Some actions may be delayed.',
};

/**
 * A strip above the tab bar that says when the app is offline or its connection is unstable.
 *
 * Only likes, saves and check-ins wait for the connection to come back, so the offline copy
 * names them rather than promising that every action syncs. VoiceOver and TalkBack announce
 * the message when it first appears or changes.
 *
 * @returns The banner, or `null` while the connection is fine.
 */
export function ConnectionBanner(): ReactElement | null {
  const status: ConnectionStatus = useConnectionStore(selectConnectionStatus);
  const theme = useResolvedTheme();

  useEffect((): void => {
    if (status !== 'online') AccessibilityInfo.announceForAccessibility(CONNECTION_BANNER_COPY[status]);
  }, [status]);

  if (status === 'online') return null;

  const Icon = status === 'offline' ? WifiOff : CloudOff;
  return (
    <View
      testID="connection-banner"
      className="flex-row items-center gap-xs border-b border-border bg-muted px-md py-xs"
      accessibilityRole="text"
    >
      <Icon size={16} color={Colors[theme]['muted-foreground']} />
      <Text className="flex-1 text-body-md text-foreground">{CONNECTION_BANNER_COPY[status]}</Text>
    </View>
  );
}
