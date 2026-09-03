import type { ReactElement } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/common/Text';
import type { ReactionSummary, ReactionType } from '@/types/chat.types';
import { CHAT_REACTION_OPTIONS, getReactionAccessibilityLabel } from '@/utils/chat-engagement';

/** Props for the shared message-reaction controls used by Event and Direct Chat. */
export interface MessageReactionBarProps {
  summary?: ReactionSummary | null;
  isPending?: boolean;
  containerLabel?: string;
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
  containerLabel = 'Message reactions',
  onSelect,
}: MessageReactionBarProps): ReactElement | null {
  if (summary === undefined || summary === null) return null;
  return (
    <View
      className="mt-xs flex-row items-center gap-xs"
      accessibilityRole="toolbar"
      accessibilityLabel={containerLabel}
    >
      {CHAT_REACTION_OPTIONS.map((option): ReactElement => {
        const selected: boolean = summary.myReaction === option.value;
        const count: number = summary.counts.find((entry) => entry.type === option.value)?.count ?? 0;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityLabel={getReactionAccessibilityLabel(option.value, selected)}
            accessibilityState={{ selected, disabled: isPending, busy: isPending }}
            disabled={isPending}
            onPress={(): void => onSelect(selected ? null : option.value)}
            className={`min-w-9 flex-row items-center justify-center rounded-full border px-xs py-xs ${
              selected ? 'border-primary bg-muted' : 'border-border bg-background'
            }`}
          >
            <Text accessible={false} className="text-body-md">
              {option.glyph}
            </Text>
            {count > 0 && <Text className="ml-1 text-label-sm text-muted-foreground">{String(count)}</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}
