import Markdown, { type MarkdownStyleMap } from '@ronradtke/react-native-markdown-display';
import { Image } from 'expo-image';
import { ArrowLeft, Bookmark, Calendar, Check, Clock, Heart, Share2, Star, Users } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, useWindowDimensions, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/common/Avatar';
import { Card } from '@/components/common/Card';
import { IconButton } from '@/components/common/IconButton';
import { Text } from '@/components/common/Text';
import { formatInterestLabel } from '@/constants/interests';
import { Colors } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import type { BusinessDetail } from '@/types/business.types';
import type { GanapDetail } from '@/types/ganap.types';
import type { GanapActionModel, GanapCapacityModel, GanapScheduleModel } from '@/utils/ganap-detail';
import { EVENT_DESCRIPTION_MARKDOWN_PARSER, isSafeAbsoluteMarkdownUrl } from '@/utils/markdown';
import { EventActionBar } from './EventActionBar';
import { EventLocationPreview } from './EventLocationPreview';

interface EventDetailViewProps {
  ganap: GanapDetail;
  business?: BusinessDetail;
  capacity: GanapCapacityModel;
  schedule: GanapScheduleModel;
  actionModel: GanapActionModel;
  isPrimaryPending: boolean;
  isLikePending: boolean;
  isSavePending: boolean;
  /** Whether a route-owned Event Details refresh is in progress. */
  isRefreshing?: boolean;
  onBack: () => void;
  /** Refetches the route-owned Event Details query. */
  onRefresh?: () => Promise<void>;
  onShare: () => void | Promise<void>;
  onToggleLike: () => void | Promise<void>;
  onToggleSave: () => void | Promise<void>;
  onPrimaryAction: () => void | Promise<void>;
  onSecondaryAction: () => void | Promise<void>;
}

/**
 * Scroll clearance for the absolutely positioned action bar: status label, one
 * large button, and the Report Event link.
 */
const SINGLE_ACTION_CLEARANCE = 152;

/** Extra clearance for the secondary large button and its top margin. */
const SECONDARY_ACTION_CLEARANCE = 72;

interface ScheduleItemProps {
  icon: ReactElement;
  label: string;
  value: string;
}

/**
 * Presents one date or time value in the event schedule.
 *
 * @param props - Icon, label, and formatted value.
 * @returns A schedule item with wrapping text.
 */
function ScheduleItem({ icon, label, value }: ScheduleItemProps): ReactElement {
  return (
    <View className="min-w-0 flex-1 flex-row items-start">
      <View className="mr-sm mt-1">{icon}</View>
      <View className="min-w-0 flex-1">
        <Text className="text-label-md text-muted-foreground">{label}</Text>
        <Text className="mt-1 text-body-md">{value}</Text>
      </View>
    </View>
  );
}

/**
 * Renders the loaded attendee-facing Event Details screen.
 *
 * @param props - Ganap data, derived display models, and route-owned callbacks.
 * @returns A media-first, scrollable event decision screen.
 */
export function EventDetailView({
  ganap,
  business,
  capacity,
  schedule,
  actionModel,
  isPrimaryPending,
  isLikePending,
  isSavePending,
  isRefreshing = false,
  onBack,
  onRefresh,
  onShare,
  onToggleLike,
  onToggleSave,
  onPrimaryAction,
  onSecondaryAction,
}: EventDetailViewProps): ReactElement {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const theme = useResolvedTheme();
  const [imageFailed, setImageFailed] = useState<boolean>(false);
  const sourceUrl: string | null = ganap.bannerImage || ganap.coverImage || null;
  const stackSchedule: boolean = width < 375 || fontScale >= 1.3;
  const isLiked: boolean = Boolean(ganap.isLiked);
  const isSaved: boolean = Boolean(ganap.isSaved);
  const likeColor: string = isLiked ? Colors[theme].like : Colors[theme].foreground;
  const saveColor: string = isSaved ? Colors[theme].save : Colors[theme].foreground;
  const organizerName: string = business?.name || ganap.businessName;
  const organizerBio: string | null = business?.bio?.trim() || null;
  const hasRating: boolean =
    (ganap.ratingCount ?? 0) > 0 && ganap.averageRating !== null && ganap.averageRating !== undefined;
  const imageTransition: number = reducedMotion ? 0 : 200;
  const actionBarClearance: number = SINGLE_ACTION_CLEARANCE + (actionModel.secondary ? SECONDARY_ACTION_CLEARANCE : 0);
  const markdownStyle: MarkdownStyleMap = {
    body: {
      color: Colors[theme].foreground,
      fontSize: 16,
      lineHeight: 24,
    },
    paragraph: {
      marginTop: 0,
      marginBottom: 12,
    },
    heading1: {
      color: Colors[theme].foreground,
      fontSize: 24,
      lineHeight: 32,
      marginBottom: 8,
    },
    heading2: {
      color: Colors[theme].foreground,
      fontSize: 20,
      lineHeight: 28,
      marginBottom: 8,
    },
    heading3: {
      color: Colors[theme].foreground,
      fontSize: 18,
      lineHeight: 24,
      marginBottom: 8,
    },
    strong: {
      color: Colors[theme].foreground,
      fontWeight: '700',
    },
    em: {
      color: Colors[theme].foreground,
    },
    ins: {
      color: Colors[theme].foreground,
      textDecorationLine: 'underline',
    },
    s: {
      color: Colors[theme]['muted-foreground'],
      textDecorationLine: 'line-through',
    },
    link: {
      color: Colors[theme].primary,
      textDecorationLine: 'underline',
    },
    bullet_list_icon: {
      color: Colors[theme].foreground,
    },
    ordered_list_icon: {
      color: Colors[theme].foreground,
    },
    blockquote: {
      backgroundColor: Colors[theme].muted,
      borderColor: Colors[theme].border,
    },
    code_inline: {
      color: Colors[theme].foreground,
      backgroundColor: Colors[theme].muted,
      borderColor: Colors[theme].border,
    },
    code_block: {
      color: Colors[theme].foreground,
      backgroundColor: Colors[theme].muted,
      borderColor: Colors[theme].border,
    },
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset image fallback state when the selected source changes.
  useEffect((): void => {
    setImageFailed(false);
  }, [sourceUrl]);

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        testID="event-detail-scroll"
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + actionBarClearance }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={(): void => {
              void onRefresh?.();
            }}
          />
        }
      >
        <View className="w-full max-w-3xl self-center">
          <View className="relative h-64 overflow-hidden rounded-b-xl bg-muted">
            {sourceUrl && !imageFailed ? (
              <Image
                source={{ uri: sourceUrl }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                transition={imageTransition}
                accessibilityLabel={`${ganap.title} event image`}
                onError={(): void => setImageFailed(true)}
              />
            ) : (
              <View className="h-full w-full items-center justify-center bg-muted" accessible={false}>
                <Calendar size={48} className="text-muted-foreground" />
              </View>
            )}

            <View
              className="absolute left-0 right-0 flex-row items-center justify-between px-md"
              style={{ top: insets.top + 8 }}
            >
              <IconButton
                size="lg"
                variant="default"
                accessibilityLabel="Go back"
                accessibilityHint="Returns to the previous screen"
                onPress={onBack}
              >
                <ArrowLeft size={24} className="text-foreground" />
              </IconButton>

              <View className="flex-row gap-sm">
                <IconButton
                  size="lg"
                  variant="default"
                  accessibilityLabel="Share event"
                  accessibilityHint="Opens the device share sheet"
                  onPress={(): void => {
                    void onShare();
                  }}
                >
                  <Share2 size={22} className="text-foreground" />
                </IconButton>
                <IconButton
                  size="lg"
                  variant="default"
                  selected={isLiked}
                  disabled={isLikePending}
                  accessibilityLabel={isLiked ? 'Unlike event' : 'Like event'}
                  onPress={(): void => {
                    void onToggleLike();
                  }}
                >
                  <Heart size={22} color={likeColor} fill={isLiked ? likeColor : 'none'} />
                </IconButton>
                <IconButton
                  size="lg"
                  variant="default"
                  selected={isSaved}
                  disabled={isSavePending}
                  accessibilityLabel={isSaved ? 'Unsave event' : 'Save event'}
                  onPress={(): void => {
                    void onToggleSave();
                  }}
                >
                  <Bookmark size={22} color={saveColor} fill={isSaved ? saveColor : 'none'} />
                </IconButton>
              </View>
            </View>
          </View>

          <View className="px-md">
            <Text className="mt-lg text-headline-lg" accessibilityRole="header">
              {ganap.title}
            </Text>

            {actionModel.statusLabel && (
              <View className="mt-sm flex-row self-start rounded-full bg-muted px-sm py-xs">
                <Text className="text-label-md text-muted-foreground">{actionModel.statusLabel}</Text>
              </View>
            )}

            {ganap.tags.length > 0 && (
              <View className="mt-md flex-row flex-wrap gap-sm">
                {ganap.tags.map(
                  (tag: string): ReactElement => (
                    <View key={tag} className="rounded-full border border-border bg-background px-sm py-xs">
                      <Text className="text-label-sm">{formatInterestLabel(tag)}</Text>
                    </View>
                  ),
                )}
              </View>
            )}

            <View className="mt-md flex-row flex-wrap items-center gap-lg">
              {hasRating && (
                <View className="flex-row items-center">
                  <Star size={16} className="mr-xs fill-primary text-primary" />
                  <Text className="text-body-md">{ganap.averageRating?.toFixed(1)}</Text>
                  <Text className="ml-xs text-body-md text-muted-foreground">({ganap.ratingCount})</Text>
                </View>
              )}
              <View className="flex-row items-center">
                <View className="mr-xs">
                  <Heart size={16} className="text-muted-foreground" />
                </View>
                <Text className="text-body-md text-muted-foreground">{ganap.likesCount ?? 0} likes</Text>
              </View>
            </View>

            <Card className="mt-lg">
              <View className="flex-row items-start">
                <View className="mr-sm mt-1">
                  <Users size={20} className="text-primary" />
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="text-headline-sm">{capacity.summary}</Text>
                  {capacity.detail && (
                    <Text className="mt-1 text-body-md text-muted-foreground">{capacity.detail}</Text>
                  )}
                  {ganap.requiresApproval && !capacity.isFull && (
                    <Text className="mt-sm text-body-md text-muted-foreground">Organizer approval required</Text>
                  )}
                </View>
              </View>
            </Card>

            <View className={`mt-lg gap-md ${stackSchedule ? '' : 'flex-row'}`}>
              <ScheduleItem
                icon={<Calendar size={20} className="text-primary" />}
                label="Date"
                value={schedule.dateLabel}
              />
              <ScheduleItem
                icon={<Clock size={20} className="text-primary" />}
                label="Time"
                value={schedule.timeLabel}
              />
            </View>

            <Text className="mt-xl text-headline-md">Hosted by</Text>
            <Card className="mt-sm">
              <View className="flex-row items-start">
                <View accessible accessibilityLabel={`${organizerName} organizer image`}>
                  <Avatar src={business?.displayPicture} name={organizerName} size="sm" />
                </View>
                <View className="ml-sm min-w-0 flex-1">
                  <View className="flex-row flex-wrap items-center">
                    <Text className="text-headline-sm">{organizerName}</Text>
                    {business?.verificationStatus === 'ACTIVE' && (
                      <View className="ml-sm flex-row items-center rounded-full bg-primary px-sm py-xs">
                        <View className="mr-xs">
                          <Check size={14} strokeWidth={2.5} color={Colors[theme]['primary-foreground']} />
                        </View>
                        <Text className="text-label-sm text-primary-foreground">Verified</Text>
                      </View>
                    )}
                  </View>
                  <Text className="mt-1 text-body-md text-muted-foreground">Event organizer</Text>
                  {organizerBio && <Text className="mt-sm text-body-md">{organizerBio}</Text>}
                </View>
              </View>
            </Card>

            <Text className="mt-xl text-headline-md">About</Text>
            <View className="mt-sm">
              <Markdown
                allowedImageHandlers={[]}
                defaultImageHandler={null}
                markdownit={EVENT_DESCRIPTION_MARKDOWN_PARSER}
                onLinkPress={isSafeAbsoluteMarkdownUrl}
                style={markdownStyle}
                colorScheme={theme}
              >
                {ganap.description}
              </Markdown>
            </View>

            <Text className="mt-xl text-headline-md">Location</Text>
            <View className="mt-sm">
              <EventLocationPreview ganap={ganap} />
            </View>
          </View>
        </View>
      </ScrollView>

      <EventActionBar
        model={actionModel}
        isPending={isPrimaryPending}
        onPrimaryAction={onPrimaryAction}
        onSecondaryAction={onSecondaryAction}
      />
    </View>
  );
}
