import { Sparkles } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/common/Button';
import { Text } from '@/components/common/Text';
import { Colors } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';

interface WalkEndViewProps {
  /** How many cards the User moved past; zero means the walk had nothing to show. */
  viewed: number;
  /** Whether the User liked, saved or registered for something, so a walk can resemble it. */
  canSeed: boolean;
  onMoreLikeThis: () => void;
  onNewWalk: () => void;
}

/**
 * The last card of an Event Walk.
 *
 * Offers "More like this" when the User liked, saved or registered for an event during the
 * walk, with "Start a new walk" beside it, and only "Start a new walk" otherwise.
 *
 * @param props - How the walk went and the two ways to continue
 * @returns The end-of-walk message and actions
 */
export function WalkEndView({ viewed, canSeed, onMoreLikeThis, onNewWalk }: WalkEndViewProps): ReactElement {
  const theme = useResolvedTheme();
  const isEmpty: boolean = viewed === 0;

  return (
    <View testID="walk-end" className="flex-1 items-center justify-center gap-md p-xl">
      <Sparkles size={32} color={Colors[theme].primary} />
      <View className="gap-xs">
        <Text className="text-center font-inter-semibold text-headline-sm" accessibilityRole="header">
          {isEmpty ? 'Nothing to show yet' : 'You have seen all your picks'}
        </Text>
        <Text className="text-center text-body-md text-muted-foreground">
          {isEmpty
            ? 'There are no upcoming events to recommend right now. Check back later.'
            : canSeed
              ? 'Want more events like the ones you liked, saved or joined?'
              : 'Like or save events as you go and the next walk gets closer to what you enjoy.'}
        </Text>
      </View>
      <View className="w-full gap-sm">
        {canSeed ? (
          <>
            <Button size="lg" onPress={onMoreLikeThis}>
              More like this
            </Button>
            <Button size="lg" variant="outline" onPress={onNewWalk}>
              Start a new walk
            </Button>
          </>
        ) : (
          <Button size="lg" onPress={onNewWalk}>
            Start a new walk
          </Button>
        )}
      </View>
    </View>
  );
}
