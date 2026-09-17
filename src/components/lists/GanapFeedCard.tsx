import { Image } from 'expo-image';
import { Calendar, Clock, MapPin, Users } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { Pressable, View } from 'react-native';
import { Card } from '@/components/common/Card';
import { Text } from '@/components/common/Text';
import { Colors } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import type { GanapListItem } from '@/types/ganap.types';
import { formatFeedEventDate } from '@/utils/formatting';

export interface GanapFeedCardProps {
  ganap: GanapListItem;
  onPress: () => void;
}

/**
 * One event in the feed sheet.
 *
 * Ported from the MagicPath `Ganapps – Map Home` design. Three of the fields
 * that design draws do not exist on the public list response, so each degrades
 * rather than being faked: no organization logo (initial letter instead), no
 * verified badge, and no attendee cap (a bare count, never `9/15`). Likes are
 * hardcoded to zero server-side and are deliberately absent.
 *
 * @param props - The event to render and the tap handler
 * @returns A pressable event card
 */
export function GanapFeedCard({ ganap, onPress }: GanapFeedCardProps): ReactElement {
  const theme = useResolvedTheme();
  const category: string | undefined = ganap.tags[0];
  const address: string | null = ganap.address ?? null;
  const initial: string = ganap.businessName.charAt(0).toUpperCase();

  /**
   * lucide-react-native registers no cssInterop, so a className on an icon is
   * silently ignored. Icon colours come from the resolved theme instead.
   */
  const accent: string = Colors[theme].primary;
  const subdued: string = Colors[theme]['muted-foreground'];

  return (
    <Pressable
      testID="ganap-feed-card"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${ganap.title}, hosted by ${ganap.businessName}`}
      className="active:opacity-80"
    >
      <Card className="mb-sm">
        {category && (
          <View testID="ganap-feed-card-category" className="mb-xs self-start rounded-full bg-muted px-sm py-1">
            <Text className="font-inter-bold text-label-md uppercase text-primary">{category}</Text>
          </View>
        )}

        <View className="flex-row items-start gap-sm">
          {ganap.coverImage ? (
            <Image
              source={{ uri: ganap.coverImage }}
              contentFit="cover"
              className="h-16 w-16 rounded-lg bg-muted"
              accessibilityLabel={`${ganap.title} event image`}
            />
          ) : (
            <View
              testID="ganap-feed-card-cover-placeholder"
              className="h-16 w-16 items-center justify-center rounded-lg bg-muted"
            >
              <Calendar size={22} color={subdued} />
            </View>
          )}

          <Text className="flex-1 font-inter-bold text-body-xl text-foreground" numberOfLines={2}>
            {ganap.title}
          </Text>
        </View>

        <View className="mt-xs gap-1">
          <View className="flex-row items-center gap-xs">
            <Clock size={16} color={accent} />
            <Text className="text-body-md text-muted-foreground">{formatFeedEventDate(ganap.startDate)}</Text>
          </View>

          {address && (
            <View testID="ganap-feed-card-location" className="flex-row items-center gap-xs">
              <MapPin size={16} color={accent} />
              <Text className="flex-1 text-body-md text-muted-foreground" numberOfLines={1}>
                {address}
              </Text>
            </View>
          )}
        </View>

        <View className="mt-sm flex-row items-center justify-between border-t border-border pt-sm">
          <View className="min-w-0 flex-1 flex-row items-center gap-xs">
            <View className="h-8 w-8 items-center justify-center rounded-full bg-muted">
              <Text
                testID="ganap-feed-card-host-initial"
                className="font-inter-bold text-label-md text-muted-foreground"
              >
                {initial}
              </Text>
            </View>
            <Text className="font-inter-semibold text-body-md text-foreground" numberOfLines={1}>
              {ganap.businessName}
            </Text>
          </View>

          <View className="flex-row items-center gap-1 rounded-full bg-muted px-sm py-1">
            <Users size={14} color={subdued} />
            <Text className="font-inter-medium text-label-md text-muted-foreground">{ganap.registrationCount}</Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
