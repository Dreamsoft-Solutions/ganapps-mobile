import type { ReactElement } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/common/Text';
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
  onSelect: (reaction: ReactionType | null) => void;
}

/**
 * Renders the five native reaction choices and aggregate counts.
 *
 * The server omits the summary when engagement is unavailable; in that case
 * the bar stays hidden instead of guessing a zero-count state.
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
  onSelect,
}: MessageReactionBarProps): ReactElement | null {
  if (summary === undefined || summary === null) return null;
  const reactions: { option: (typeof CHAT_REACTION_OPTIONS)[number]; count: number }[] = CHAT_REACTION_OPTIONS.map(
    (
      option: (typeof CHAT_REACTION_OPTIONS)[number],
    ): { option: (typeof CHAT_REACTION_OPTIONS)[number]; count: number } => ({
      option,
      count: summary.counts.find((entry) => entry.type === option.value)?.count ?? 0,
    }),
  ).filter(
    (reaction: { option: (typeof CHAT_REACTION_OPTIONS)[number]; count: number }): boolean =>
      presentation !== 'summary' || reaction.count > 0,
  );
  if (reactions.length === 0) return null;
  return (
    <View
      className={`flex-row items-center gap-xs ${presentation === 'summary' ? 'flex-wrap' : ''} ${presentation === 'tray' ? 'justify-center rounded-full bg-muted px-xs py-xs' : 'mt-xs'}`}
      accessibilityRole="toolbar"
      accessibilityLabel={containerLabel}
    >
      {reactions.map(
        ({ option, count }: { option: (typeof CHAT_REACTION_OPTIONS)[number]; count: number }): ReactElement => {
          const selected: boolean = summary.myReaction === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityLabel={getReactionAccessibilityLabel(option.value, selected)}
              accessibilityState={{ selected, disabled: isPending || isDisabled, busy: isPending }}
              disabled={isPending || isDisabled}
              onPress={(): void => onSelect(selected ? null : option.value)}
              className={`${presentation === 'tray' ? 'flex-1' : ''} min-h-touch min-w-touch flex-row items-center justify-center rounded-full border px-xs py-xs ${
                selected ? 'border-primary bg-muted' : 'border-border bg-background'
              }`}
            >
              <Text accessible={false} className="text-body-md">
                {option.glyph}
              </Text>
              {count > 0 && <Text className="ml-1 text-label-sm text-muted-foreground">{String(count)}</Text>}
            </Pressable>
          );
        },
      )}
    </View>
  );
}
