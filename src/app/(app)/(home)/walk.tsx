import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useCallback } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/common/Button';
import { ErrorView } from '@/components/common/Error';
import { Loading } from '@/components/common/Loading';
import { Text } from '@/components/common/Text';
import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { WalkActionBar } from '@/components/walk/WalkActionBar';
import { WalkCardView } from '@/components/walk/WalkCardView';
import { WalkEndView } from '@/components/walk/WalkEndView';
import { Routes } from '@/constants/routes';
import { useEventWalk } from '@/hooks/useEventWalk';
import { useWalkLocation } from '@/hooks/useWalkLocation';

/**
 * Event Walk: recommended events, one at a time.
 *
 * Shows the card the walk is on, with Like, Save and Next below it. Tapping the card opens
 * the event, and coming back lands on the same card. The walk's end offers a new walk,
 * seeded with what the User liked, saved or registered for. A 403 closes the walk.
 *
 * @returns The walk screen
 */
export default function WalkScreen(): ReactElement {
  const router = useRouter();
  const location = useWalkLocation();
  const walk = useEventWalk(location);
  const { screen, open } = walk;

  const handleBack = useCallback((): void => {
    if (router.canGoBack()) router.back();
    else router.replace(Routes.app.home);
  }, [router]);

  const handleOpen = useCallback((): void => {
    if (screen.kind !== 'card') return;
    open();
    router.push(Routes.ganapDetail(screen.card.id));
  }, [router, screen, open]);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="For you" onBack={handleBack} backHint="Returns to the map" />
      {screen.kind === 'loading' ? <Loading message="Finding events for you" /> : null}
      {screen.kind === 'error' ? <ErrorView error={screen.error} onRetry={walk.retry} /> : null}
      {screen.kind === 'closed' ? (
        <View testID="walk-closed" className="flex-1 items-center justify-center gap-md p-xl">
          <View className="gap-xs">
            <Text className="text-center font-inter-semibold text-headline-sm" accessibilityRole="header">
              For you is not available
            </Text>
            <Text className="text-center text-body-md text-muted-foreground">
              Recommended events are not available for your account right now.
            </Text>
          </View>
          <Button variant="outline" onPress={handleBack}>
            Back to map
          </Button>
        </View>
      ) : null}
      {screen.kind === 'end' ? (
        <WalkEndView
          viewed={screen.viewed}
          canSeed={screen.seedIds.length > 0}
          onMoreLikeThis={walk.startMoreLikeThis}
          onNewWalk={walk.startNewWalk}
        />
      ) : null}
      {screen.kind === 'card' ? (
        <>
          <WalkCardView key={screen.card.id} card={screen.card} onOpen={handleOpen} />
          <WalkActionBar
            isLiked={screen.card.isLiked}
            isSaved={screen.card.isSaved}
            isLikePending={walk.isLikePending}
            isSavePending={walk.isSavePending}
            onToggleLike={walk.toggleLike}
            onToggleSave={walk.toggleSave}
            onNext={walk.next}
          />
        </>
      ) : null}
    </View>
  );
}
