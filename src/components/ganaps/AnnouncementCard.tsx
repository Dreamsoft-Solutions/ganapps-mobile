import { BellRing, Megaphone, RefreshCw } from 'lucide-react-native';
import type { ComponentType, ReactElement } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { MessageReactionBar } from '@/components/chat/MessageReactionBar';
import { Avatar } from '@/components/common/Avatar';
import { Card } from '@/components/common/Card';
import { Text } from '@/components/common/Text';
import { Colors, type ThemeColor } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import type { ReactionType } from '@/types/chat.types';
import type { AnnouncementType, GanapAnnouncement } from '@/types/ganap.types';
import { formatDateTime } from '@/utils/formatting';

interface AnnouncementCardProps {
  announcement: GanapAnnouncement;
  /** Name of the organization hosting the Ganap, shown as the announcement author. */
  organizationName: string;
  /** Organization logo URL; the avatar falls back to initials when it is absent. */
  organizationLogo?: string | null;
  /** Sets or removes the attendee's acknowledgement reaction. */
  onReaction?: (reaction: ReactionType | null) => void;
  /** Whether this announcement reaction is being reconciled. */
  reactionPending?: boolean;
}

/** Icon props accepted by the lucide icons used for announcement types. */
interface AnnouncementIconProps {
  size?: number;
  color?: string;
}

/** Text-backed presentation for one announcement type. */
interface AnnouncementTypeConfig {
  label: string;
  Icon: ComponentType<AnnouncementIconProps>;
  chipClassName: string;
  textClassName: string;
  iconColor: ThemeColor;
}

/**
 * Presentation for each announcement type.
 *
 * Every type carries its own written label and icon, so the type stays readable
 * without relying on color. The three tonal families — informational blue,
 * time-sensitive amber, and change-signalling violet — are chosen so no chip
 * competes with `primary`, which this app reserves for brand and actions: a
 * type chip is metadata and must read quieter than the announcement it labels.
 *
 * Fills are soft tokens paired with same-hue foregrounds rather than opacity
 * modifiers, because `--info` and friends hold hex values and `bg-info/10`
 * would resolve to no background at all.
 */
const announcementTypeConfig: Record<AnnouncementType, AnnouncementTypeConfig> = {
  GENERAL: {
    label: 'General',
    Icon: Megaphone,
    chipClassName: 'bg-info',
    textClassName: 'text-info-foreground',
    iconColor: 'info-foreground',
  },
  REMINDER: {
    label: 'Reminder',
    Icon: BellRing,
    chipClassName: 'bg-warning',
    textClassName: 'text-warning-foreground',
    iconColor: 'warning-foreground',
  },
  UPDATE: {
    label: 'Update',
    Icon: RefreshCw,
    chipClassName: 'bg-notice',
    textClassName: 'text-notice-foreground',
    iconColor: 'notice-foreground',
  },
};

/**
 * Renders one organizer announcement with its author, type, and timestamp.
 *
 * The author is the hosting organization, not the member account that posted:
 * attendees follow organizations, and a member's username can be an email
 * address. The heading stays on one line so long names truncate. At large text
 * sizes the timestamp moves under the author, so it cannot squeeze the name out.
 *
 * @param props - The announcement, its organization's name and logo, and reaction state.
 * @returns An announcement card.
 */
export function AnnouncementCard({
  announcement,
  organizationName,
  organizationLogo = null,
  onReaction = (): void => {},
  reactionPending = false,
}: AnnouncementCardProps): ReactElement {
  const config: AnnouncementTypeConfig = announcementTypeConfig[announcement.type];
  const TypeIcon: ComponentType<AnnouncementIconProps> = config.Icon;
  const title: string | null = announcement.title?.trim() || null;
  const theme = useResolvedTheme();
  const { fontScale } = useWindowDimensions();
  const stackHeader: boolean = fontScale >= 1.3;

  return (
    <Card className="mb-sm">
      <View className={stackHeader ? 'gap-xs' : 'flex-row items-start justify-between gap-sm'}>
        <View className={`min-w-0 flex-row items-center ${stackHeader ? '' : 'flex-1'}`}>
          <Avatar src={organizationLogo} name={organizationName} size="xs" />
          <View className="ml-xs min-w-0 flex-1">
            <Text numberOfLines={1} className="font-inter-semibold text-headline-sm">
              {organizationName}
            </Text>
            <Text className="mt-1 font-inter-medium text-label-sm text-muted-foreground">Event organizer</Text>
          </View>
        </View>
        <Text className="font-inter-medium text-label-sm text-muted-foreground">
          {formatDateTime(announcement.createdAt)}
        </Text>
      </View>

      <View className={`mt-sm flex-row items-center self-start rounded-full px-sm py-xs ${config.chipClassName}`}>
        <View className="mr-xs">
          {/* lucide-react-native has no cssInterop, so a className here would be ignored. */}
          <TypeIcon size={12} color={Colors[theme][config.iconColor]} />
        </View>
        <Text className={`font-inter-semibold text-label-sm ${config.textClassName}`}>{config.label}</Text>
      </View>

      {title && <Text className="mt-sm font-inter-semibold text-headline-sm">{title}</Text>}

      <Text className="mt-sm text-body-md">{announcement.content}</Text>

      <MessageReactionBar
        summary={announcement.reactionSummary}
        containerLabel="Announcement acknowledgement"
        isPending={reactionPending}
        onSelect={onReaction}
      />
    </Card>
  );
}
