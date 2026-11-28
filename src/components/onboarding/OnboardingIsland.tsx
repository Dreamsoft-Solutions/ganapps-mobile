import { useMemo, type ReactElement } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, { Extrapolation, interpolate, type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { Button } from '@/components/common/Button';
import { Glass } from '@/components/common/Glass';
import { Text } from '@/components/common/Text';
import { BRAND_TAGLINE } from '@/constants/onboarding';
import { BorderRadius } from '@/constants/theme';

/** Diameter of one page dot, dp. */
const DOT_SIZE: number = 6;

/** Space between two page dots, dp. */
const DOT_GAP: number = 8;

/** Distance between two dot centres, dp. */
const DOT_PITCH: number = DOT_SIZE + DOT_GAP;

/** Width of the active-page pill, dp. */
const PILL_WIDTH: number = 16;

/** The island's inner layout. Glass draws the material; this only spaces the content. */
const ISLAND_STYLE = { padding: 16, flexDirection: 'column', gap: 12 } as const satisfies ViewStyle;

/** The dots row, laid out so the pill can sit absolutely over it. */
const DOTS_STYLE = { flexDirection: 'row', gap: DOT_GAP } as const satisfies ViewStyle;

/** One resting page dot. */
const DOT_STYLE = { width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2 } as const satisfies ViewStyle;

/** The active-page pill frame, centred on the first dot. */
const PILL_FRAME_STYLE = {
  position: 'absolute',
  top: 0,
  left: (DOT_SIZE - PILL_WIDTH) / 2,
  width: PILL_WIDTH,
  height: DOT_SIZE,
} as const satisfies ViewStyle;

/** The pill's fill, inside its animated frame. */
const PILL_FILL_STYLE = { flex: 1, borderRadius: DOT_SIZE / 2 } as const satisfies ViewStyle;

/** Props for {@link OnboardingIsland}. */
export interface OnboardingIslandProps {
  scrollX: SharedValue<number>;
  pageWidth: number;
  pageCount: number;
  onGetStarted: () => void;
  onLogIn: () => void;
}

/**
 * The Welcome island: a strong Glass pane holding the page dots, the two sign-in actions and the
 * tagline. The pill slides between dots with the pager's offset on the UI thread; the dots are
 * hidden from screen readers.
 *
 * @example
 * <OnboardingIsland
 *   scrollX={scrollX}
 *   pageWidth={width}
 *   pageCount={ONBOARDING_SLIDES.length}
 *   onGetStarted={openLogin}
 *   onLogIn={openLogin}
 * />
 */
export function OnboardingIsland({
  scrollX,
  pageWidth,
  pageCount,
  onGetStarted,
  onLogIn,
}: OnboardingIslandProps): ReactElement {
  const lastIndex = Math.max(pageCount - 1, 0);

  const pillMotion = useAnimatedStyle((): ViewStyle => {
    const end = lastIndex * pageWidth;
    const translateX =
      end > 0 ? interpolate(scrollX.get(), [0, end], [0, lastIndex * DOT_PITCH], Extrapolation.CLAMP) : 0;
    return { transform: [{ translateX }] };
  });

  const dotKeys = useMemo(
    (): readonly number[] => Array.from({ length: pageCount }, (_: unknown, index: number): number => index),
    [pageCount],
  );

  return (
    <Glass variant="strong" rim="lg" lift="island" radius={BorderRadius['2xl']} style={ISLAND_STYLE}>
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="flex-row items-center justify-center"
      >
        <View style={DOTS_STYLE}>
          {dotKeys.map(
            (key: number): ReactElement => (
              <View key={key} className="bg-border" style={DOT_STYLE} />
            ),
          )}
          <Animated.View style={[PILL_FRAME_STYLE, pillMotion]}>
            <View className="bg-primary" style={PILL_FILL_STYLE} />
          </Animated.View>
        </View>
      </View>
      <Button size="auth" onPress={onGetStarted}>
        Get started
      </Button>
      <Button variant="secondary" size="auth" onPress={onLogIn}>
        Log in
      </Button>
      <Text className="text-label-sm text-muted-foreground text-center">{BRAND_TAGLINE}</Text>
    </Glass>
  );
}
