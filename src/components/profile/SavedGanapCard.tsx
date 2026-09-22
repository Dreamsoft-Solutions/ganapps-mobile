import { Image } from 'expo-image';
import { Bookmark, Calendar, Clock } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { Pressable, View } from 'react-native';
import { Card } from '@/components/common/Card';
import { IconButton } from '@/components/common/IconButton';
import { Text } from '@/components/common/Text';
import { formatInterestLabel } from '@/constants/interests';
import { Colors } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import type { GanapStatus } from '@/types/ganap.types';
import type { SavedGanap } from '@/types/profile.types';

/**
 * Fill the thumbnail as a real style object, not a class.
 *
 * `expo-image` registers no `cssInterop`, so it drops a `className` silently
 * and the image collapses to nothing. Same fix DS-44 applied to the feed
 * poster; see `GanapFeedCard.POSTER_FILL`.
 */
const THUMBNAIL_FILL = { width: '100%', height: '100%' } as const;

const STATUS_LABELS: Partial<Record<GanapStatus, string>> = {
  ONGOING: 'In progress',
  COMPLETED: 'Ended',
  CANCELLED: 'Cancelled',
};

interface SavedGanapCardProps {
  ganap: SavedGanap;
  onPress?: () => void;
  onUnsave?: () => void;
}

/**
 * Compact saved Ganap row for the My Events tab.
 *
 * Shows a status pill only when the event is in progress, over, or cancelled.
 * The saved list has no time filter, so a stale row has to say so itself.
 *
 * @param props - Ganap data, an optional detail handler, and an optional unsave handler.
 * @returns A pressable saved Ganap card.
 */
export function SavedGanapCard({ ganap, onPress, onUnsave }: SavedGanapCardProps): ReactElement {
  const theme = useResolvedTheme();
  const statusLabel: string | undefined = STATUS_LABELS[ganap.status];
  const firstTag: string | undefined = ganap.tags[0];
  const coverImage: string | null = ganap.coverImage || null;
  const saveColor: string = Colors[theme].save;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? ganap.title : undefined}
      className="active:opacity-80"
    >
      <Card className="mb-sm flex-row items-start">
        <View className="mr-sm h-10 w-10 overflow-hidden rounded-md bg-primary/10">
          {coverImage ? (
            <Image
              source={{ uri: coverImage }}
              style={THUMBNAIL_FILL}
              contentFit="cover"
              accessibilityLabel={`${ganap.title} event image`}
            />
          ) : (
            <View className="h-full w-full items-center justify-center">
              <Calendar size={18} className="text-primary" />
            </View>
          )}
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-headline-sm" numberOfLines={2}>
            {ganap.title}
          </Text>
          <Text className="mt-1 text-label-sm text-muted-foreground" numberOfLines={1}>
            {ganap.businessName}
          </Text>
          <View className="mt-2 flex-row items-center">
            <View className="mr-xs">
              <Clock size={12} className="text-muted-foreground" />
            </View>
            <Text className="text-label-sm text-muted-foreground">{formatSavedGanapDate(ganap.startDate)}</Text>
          </View>
        </View>
        <View className="ml-sm items-end">
          {statusLabel !== undefined && (
            <View testID="saved-ganap-status" className="rounded-full bg-muted px-2 py-1">
              <Text className="text-label-sm text-muted-foreground">{statusLabel}</Text>
            </View>
          )}
          {firstTag && (
            <Text className="mt-2 max-w-24 text-right text-label-sm text-muted-foreground" numberOfLines={1}>
              {formatInterestLabel(firstTag)}
            </Text>
          )}
        </View>
        {onUnsave && (
          <View className="ml-xs">
            <IconButton onPress={onUnsave} selected accessibilityLabel={`Remove ${ganap.title} from saved events`}>
              <Bookmark size={20} color={saveColor} fill={saveColor} />
            </IconButton>
          </View>
        )}
      </Card>
    </Pressable>
  );
}

/**
 * Formats a Ganap start time for a compact mobile row.
 *
 * @param isoDate - ISO date returned by the server.
 * @returns A localized short date and time.
 */
function formatSavedGanapDate(isoDate: string): string {
  return new Date(isoDate).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
