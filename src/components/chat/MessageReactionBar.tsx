import { Plus } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/common/Text';
import { Spacing } from '@/constants/theme';
import { MIN_TOUCH_TARGET } from '@/constants/touch-target';
import type { ReactionSummary, ReactionType } from '@/types/chat.types';
import { CHAT_REACTION_OPTIONS, getReactionAccessibilityLabel } from '@/utils/chat-engagement';

/** Props for the shared reaction controls used by chat action surfaces and announcements. */
export interface MessageReactionBarProps {
  summary?: ReactionSummary | null;
  isPending?: boolean;
  isDisabled?: boolean;
  containerLabel?: string;
  /** `summary` shows only reactions with counts; `inline` and `tray` show all choices. */
  presentation?: 'inline' | 'summary' | 'tray';
  /** Aligns compact summary badges with the side of their message bubble. */
  alignment?: 'left' | 'right';
  /** Opens the reaction picker from the compact message badge group. */
  onRequestReactionPicker?: () => void;
  onSelect: (reaction: ReactionType | null) => void;
}

type ReactionOption = (typeof CHAT_REACTION_OPTIONS)[number];
type ReactionPresentation = NonNullable<MessageReactionBarProps['presentation']>;

interface ReactionOptionCount {
  option: ReactionOption;
  count: number;
}

interface ReactionOptionButtonProps {
  choice: ReactionOptionCount;
  summary: ReactionSummary | null;
  isPending: boolean;
  isDisabled: boolean;
  presentation: ReactionPresentation;
  compactBadgeSize: number;
  onSelect: MessageReactionBarProps['onSelect'];
}

function ReactionOptionButton({
  choice,
  summary,
  isPending,
  isDisabled,
  presentation,
  compactBadgeSize,
  onSelect,
}: ReactionOptionButtonProps): ReactElement {
  const { option, count } = choice;
  const selected: boolean = summary?.myReaction === option.value;
  const compact: boolean = presentation === 'summary';
  const optionClassName: string = compact
    ? 'items-center justify-center rounded-full border'
    : `${presentation === 'tray' ? 'flex-1' : ''} min-h-touch min-w-touch flex-row items-center justify-center rounded-full border px-xs py-xs`;
  const selectionClassName: string = selected ? 'border-primary bg-muted' : 'border-border bg-background';
  const className: string = `${optionClassName} ${selectionClassName}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={getReactionAccessibilityLabel(option.value, selected)}
      accessibilityState={{ selected, disabled: isPending || isDisabled, busy: isPending }}
      disabled={isPending || isDisabled}
      onPress={(): void => onSelect(selected ? null : option.value)}
      hitSlop={compact ? Spacing.base : undefined}
      style={compact ? { width: compactBadgeSize, height: compactBadgeSize } : undefined}
      className={className}
    >
      <Text accessible={false} className={compact ? 'text-label-md' : 'text-body-md'}>
        {option.glyph}
      </Text>
      {count > 0 && (
        <Text className={compact ? 'text-label-sm text-muted-foreground' : 'ml-1 text-label-sm text-muted-foreground'}>
          {count > 99 ? '99+' : String(count)}
        </Text>
      )}
    </Pressable>
  );
}

/**
 * Renders the five native reaction choices and aggregate counts.
 *
 * Message summaries may offer the separate Add reaction action even before a
 * reaction aggregate exists; other presentations stay hidden without a summary.
 *
 * @param props - Server aggregate, busy state, and selection callback
 * @returns A labelled reaction row or null when the feature is unavailable
 */
export function MessageReactionBar({
  summary,
  isPending = false,
  isDisabled = false,
  containerLabel = 'Message reactions',
  presentation = 'inline',
  alignment = 'left',
  onRequestReactionPicker,
  onSelect,
}: MessageReactionBarProps): ReactElement | null {
  const reactionSummary: ReactionSummary | null = summary ?? null;
  const reactions: ReactionOptionCount[] = reactionSummary
    ? CHAT_REACTION_OPTIONS.map(
        (option: ReactionOption): ReactionOptionCount => ({
          option,
          count: reactionSummary.counts.find((entry) => entry.type === option.value)?.count ?? 0,
        }),
      ).filter((reaction: ReactionOptionCount): boolean => presentation !== 'summary' || reaction.count > 0)
    : [];
  if (reactions.length === 0 && (presentation !== 'summary' || !onRequestReactionPicker)) return null;
  const compactBadgeSize: number = MIN_TOUCH_TARGET - Spacing.xs;
  return (
    <View
      className={`flex-row items-center gap-xs ${presentation === 'tray' ? 'justify-center rounded-full bg-muted px-xs py-xs' : ''}`}
      style={
        presentation === 'summary'
          ? {
              position: 'absolute',
              bottom: 0,
              ...(alignment === 'right' ? { right: 0 } : { left: 0 }),
            }
          : presentation === 'inline'
            ? { marginTop: Spacing.xs }
            : undefined
      }
      accessibilityRole="toolbar"
      accessibilityLabel={containerLabel}
    >
      {reactions.map(
        (choice: ReactionOptionCount): ReactElement => (
          <ReactionOptionButton
            key={choice.option.value}
            choice={choice}
            summary={reactionSummary}
            isPending={isPending}
            isDisabled={isDisabled}
            presentation={presentation}
            compactBadgeSize={compactBadgeSize}
            onSelect={onSelect}
          />
        ),
      )}
      {presentation === 'summary' && onRequestReactionPicker && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add reaction"
          accessibilityHint="Opens the message reaction picker"
          accessibilityState={{ disabled: isPending || isDisabled, busy: isPending }}
          disabled={isPending || isDisabled}
          onPress={onRequestReactionPicker}
          hitSlop={Spacing.base}
          style={{ width: compactBadgeSize, height: compactBadgeSize }}
          className="items-center justify-center rounded-full border border-border bg-background"
        >
          <Plus size={16} className="text-muted-foreground" />
        </Pressable>
      )}
    </View>
  );
}
