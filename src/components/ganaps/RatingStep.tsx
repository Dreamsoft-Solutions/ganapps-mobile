import { ArrowLeft, Star } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';
import { Text } from '@/components/common/Text';
import { Colors, Spacing } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';

/** Props for the post-event star rating step. */
export interface RatingStepProps {
  ganapTitle: string;
  isSubmitting: boolean;
  submissionError: Error | null;
  onSubmit: (score: number) => void | Promise<void>;
  onSkip?: () => void;
  /** Leaves the flow without rating. The route owns where that lands. */
  onBack: () => void;
}

const SCORES: readonly number[] = [1, 2, 3, 4, 5];

/**
 * Collects the student's 1–5 star rating for an attended Ganap.
 *
 * Owns only the in-progress selection; submission, navigation, and error
 * recovery belong to the route.
 *
 * @param props - Event title, submission state, and the route's callbacks
 * @returns The rating step body
 */
export function RatingStep({
  ganapTitle,
  isSubmitting,
  submissionError,
  onSubmit,
  onSkip,
  onBack,
}: RatingStepProps): ReactElement {
  const insets = useSafeAreaInsets();
  const theme = useResolvedTheme();
  const [score, setScore] = useState<number | null>(null);

  return (
    <View className="flex-1 bg-background">
      <View className="px-md pb-sm" style={{ paddingTop: insets.top + Spacing.md }}>
        <IconButton
          size="lg"
          variant="default"
          accessibilityLabel="Go back"
          accessibilityHint="Leaves without rating this event"
          disabled={isSubmitting}
          onPress={onBack}
        >
          <ArrowLeft size={20} color={Colors[theme].foreground} />
        </IconButton>
      </View>

      <View className="flex-1 justify-center p-xl">
        <Text className="mb-xs text-center font-inter-semibold text-headline-md" accessibilityRole="header">
          How was it?
        </Text>
        <Text className="mb-lg text-center text-body-md text-muted-foreground" numberOfLines={2}>
          {ganapTitle}
        </Text>

        <View className="mb-lg flex-row justify-center gap-sm">
          {SCORES.map(
            (value: number): ReactElement => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={`${value} ${value === 1 ? 'star' : 'stars'}`}
                accessibilityState={{ selected: score !== null && value <= score }}
                disabled={isSubmitting}
                onPress={(): void => setScore(value)}
                className="min-h-11 min-w-11 items-center justify-center active:opacity-70"
              >
                <Star
                  size={36}
                  color={score !== null && value <= score ? Colors[theme].primary : Colors[theme]['muted-foreground']}
                  fill={score !== null && value <= score ? Colors[theme].primary : 'transparent'}
                />
              </Pressable>
            ),
          )}
        </View>

        {submissionError && (
          <Text accessibilityRole="alert" className="mb-sm text-center text-body-md text-destructive">
            {submissionError.message}
          </Text>
        )}

        <View className="gap-sm">
          <Button
            size="lg"
            loading={isSubmitting}
            disabled={score === null || isSubmitting}
            onPress={(): void => {
              if (score !== null) void onSubmit(score);
            }}
          >
            Submit rating
          </Button>
          {onSkip !== undefined ? (
            <Button variant="ghost" size="md" disabled={isSubmitting} onPress={onSkip}>
              Skip
            </Button>
          ) : null}
        </View>
      </View>
    </View>
  );
}
