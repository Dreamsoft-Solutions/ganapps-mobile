import { useMemo, type ReactElement } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  type SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';

import { Colors } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import { mix } from '@/utils/color-mix';

/** Size of a round page dot, dp. */
const DOT_SIZE: number = 6;

/** Width of the current page's long dot, dp. */
const DOT_LONG: number = 22;

/** Space between two neighbouring dots, dp. */
const DOT_GAP: number = 10;

/** Share of `muted-foreground` in a resting dot's colour, percent. */
const DOT_REST_MIX: number = 45;

/** One dot's static frame, placed by its animated `translateX` inside the track. */
const DOT_STYLE = {
  position: 'absolute',
  top: 0,
  left: 0,
  height: DOT_SIZE,
  borderRadius: DOT_SIZE / 2,
} as const satisfies ViewStyle;

/** Width of dot `index` at pager position `page`: long on its own page, round one page away. */
function dotWidth(page: number, index: number): number {
  'worklet';
  return interpolate(page, [index - 1, index, index + 1], [DOT_SIZE, DOT_LONG, DOT_SIZE], Extrapolation.CLAMP);
}

/** Left edge of dot `index` at pager position `page`: the dots before it, each with its gap. */
function dotLeft(page: number, index: number): number {
  'worklet';
  let left = 0;
  for (let before = 0; before < index; before += 1) {
    left += dotWidth(page, before) + DOT_GAP;
  }
  return left;
}

/** Props for {@link PageDot}. */
interface PageDotProps {
  readonly index: number;
  readonly scrollX: SharedValue<number>;
  readonly pageWidth: number;
  /** Colour of a round dot. */
  readonly restColor: string;
  /** Colour of the long dot. */
  readonly activeColor: string;
}

/** One page dot. It stretches and takes the active colour as its page arrives, 1:1 with the pager. */
function PageDot({ index, scrollX, pageWidth, restColor, activeColor }: PageDotProps): ReactElement {
  const motion = useAnimatedStyle((): ViewStyle => {
    const page = pageWidth > 0 ? scrollX.get() / pageWidth : 0;
    return {
      width: dotWidth(page, index),
      backgroundColor: interpolateColor(page, [index - 1, index, index + 1], [restColor, activeColor, restColor]),
      transform: [{ translateX: dotLeft(page, index) }],
    };
  });

  return <Animated.View style={[DOT_STYLE, motion]} />;
}

/** Props for {@link OnboardingDots}. */
export interface OnboardingDotsProps {
  /** Horizontal offset of the pager the dots follow, dp. */
  scrollX: SharedValue<number>;
  pageWidth: number;
  pageCount: number;
}

/**
 * The Welcome page dots. The current page's dot is the long one; as the pager moves, the dot being
 * left shrinks and the next one stretches on the UI thread, following the finger. The track keeps a
 * fixed width, so nothing around it reflows. Hidden from screen readers.
 *
 * @example
 * <OnboardingDots scrollX={scrollX} pageWidth={width} pageCount={ONBOARDING_SLIDES.length} />
 */
export function OnboardingDots({ scrollX, pageWidth, pageCount }: OnboardingDotsProps): ReactElement {
  const theme = useResolvedTheme();
  const restColor: string = useMemo((): string => mix(Colors[theme]['muted-foreground'], DOT_REST_MIX), [theme]);
  const activeColor: string = Colors[theme].primary;

  const trackStyle = useMemo(
    (): ViewStyle => ({
      width: Math.max(pageCount - 1, 0) * (DOT_SIZE + DOT_GAP) + DOT_LONG,
      height: DOT_SIZE,
      alignSelf: 'center',
    }),
    [pageCount],
  );

  const dotKeys = useMemo(
    (): readonly number[] => Array.from({ length: pageCount }, (_: unknown, index: number): number => index),
    [pageCount],
  );

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={trackStyle}
    >
      {dotKeys.map(
        (key: number): ReactElement => (
          <PageDot
            key={key}
            index={key}
            scrollX={scrollX}
            pageWidth={pageWidth}
            restColor={restColor}
            activeColor={activeColor}
          />
        ),
      )}
    </View>
  );
}
