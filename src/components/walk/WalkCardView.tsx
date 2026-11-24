import { Image } from 'expo-image';
import { Calendar, Clock, MapPin } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { Text } from '@/components/common/Text';
import { Colors } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import type { WalkCard } from '@/types/walk.types';
import { formatWalkDistance } from '@/utils/event-walk';
import { formatFeedEventTimeRange } from '@/utils/formatting';
import { getGanapMainTag } from '@/utils/ganap-tags';

/** Fills the sized wrapper around the cover; `expo-image` takes a style, not a className. */
const COVER_FILL = { width: '100%', height: '100%' } as const;

/**
 * A short crossfade between cards.
 *
 * Next is pressed many times in a walk, so the card does not slide. The fade only tells the
 * eye the content changed, and it follows the system's Reduce Motion setting.
 */
const CARD_ENTERING = FadeIn.duration(150).reduceMotion(ReduceMotion.System);

interface WalkCardViewProps {
  card: WalkCard;
  /** Opens the event's detail screen. */
  onOpen: () => void;
}

/**
 * The event an Event Walk is showing: cover, Main Tag, title, date and distance.
 *
 * The whole card opens the event. It scrolls, so enlarged text never runs under the action
 * bar. The parent keys it by Ganap id, so each card fades in scrolled to the top.
 *
 * @param props - The card and the open handler
 * @returns A pressable event card
 */
export function WalkCardView({ card, onOpen }: WalkCardViewProps): ReactElement {
  const theme = useResolvedTheme();
  const accent: string = Colors[theme].primary;
  const subdued: string = Colors[theme]['muted-foreground'];
  const mainTag: string | null = card.mainTag ?? getGanapMainTag(card.tags);
  const when: string = formatFeedEventTimeRange(card.startDate, card.endDate);
  const distance: string | null = formatWalkDistance(card.distanceKm);
  const where: string | null = distance ?? card.address ?? null;

  return (
    <Animated.View entering={CARD_ENTERING} className="flex-1">
      <ScrollView contentContainerClassName="p-md" showsVerticalScrollIndicator={false}>
        <Pressable
          testID="walk-card"
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={[card.title, mainTag, when, distance].filter(Boolean).join(', ')}
          accessibilityHint="Opens event details"
          className="active:opacity-80"
        >
          <View className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-muted">
            {card.coverImage ? (
              <Image
                source={{ uri: card.coverImage }}
                contentFit="cover"
                style={COVER_FILL}
                accessibilityLabel={`${card.title} event poster`}
              />
            ) : (
              <View className="h-full w-full items-center justify-center">
                <Calendar size={40} color={subdued} />
              </View>
            )}
          </View>

          {mainTag ? (
            <View testID="walk-card-main-tag" className="mt-md self-start rounded-full bg-muted px-sm py-1">
              <Text className="font-inter-bold text-label-md uppercase text-primary">{mainTag}</Text>
            </View>
          ) : null}

          <Text className={`${mainTag ? 'mt-xs' : 'mt-md'} font-inter-bold text-headline-md`} numberOfLines={3}>
            {card.title}
          </Text>

          <View className="mt-sm gap-xs">
            <View className="flex-row items-start gap-xs">
              <Clock size={16} color={accent} />
              <Text className="flex-1 text-body-md text-muted-foreground">{when}</Text>
            </View>
            {where ? (
              <View testID="walk-card-where" className="flex-row items-start gap-xs">
                <MapPin size={16} color={accent} />
                <Text className="flex-1 text-body-md text-muted-foreground" numberOfLines={2}>
                  {where}
                </Text>
              </View>
            ) : null}
          </View>
        </Pressable>
      </ScrollView>
    </Animated.View>
  );
}
