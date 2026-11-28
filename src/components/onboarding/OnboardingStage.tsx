import { Image } from 'expo-image';
import { useCallback, useMemo, type ReactElement } from 'react';
import { type ImageStyle, type NativeScrollEvent, type NativeSyntheticEvent, View, type ViewStyle } from 'react-native';
import Animated, { type ScrollEvent, type SharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';

import type { OnboardingSlide } from '@/constants/onboarding';

/** Props for {@link OnboardingStage}. */
export interface OnboardingStageProps {
  slides: readonly OnboardingSlide[];
  /** Written by the stage on every scroll frame. */
  scrollX: SharedValue<number>;
  pageWidth: number;
  /** Height of the stage, dp (the window height). */
  height: number;
  /** Called once when the pager settles on a slide. */
  onIndexChange: (index: number) => void;
}

/**
 * The Welcome pager: one full-screen photo per slide. Each photo covers the stage from its centre,
 * and every stage canvas keeps the phone in it on the canvas centre, so the phone stays on the
 * centre of any screen: a wider stage crops the top and bottom evenly, a taller one the sides. The
 * stage writes the horizontal offset into `scrollX` on every frame on the UI thread and reports the
 * settled slide once momentum ends.
 *
 * @example
 * <OnboardingStage
 *   slides={ONBOARDING_SLIDES}
 *   scrollX={scrollX}
 *   pageWidth={width}
 *   height={stageHeight}
 *   onIndexChange={setActiveIndex}
 * />
 *
 * @param props - The slides, the shared scroll offset, the page size, and the settled-slide callback.
 * @returns The cut-out photo stage.
 */
export function OnboardingStage({
  slides,
  scrollX,
  pageWidth,
  height,
  onIndexChange,
}: OnboardingStageProps): ReactElement {
  /** The pager frame, each page and each photo share one size. */
  const pageStyle = useMemo((): ViewStyle => ({ width: pageWidth, height }), [pageWidth, height]);
  const imageStyle = useMemo((): ImageStyle => ({ width: pageWidth, height }), [pageWidth, height]);

  const handleScroll = useAnimatedScrollHandler(
    {
      onScroll: (event: ScrollEvent): void => {
        'worklet';
        scrollX.set(event.contentOffset.x);
      },
    },
    [scrollX],
  );

  const handleMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
      if (pageWidth <= 0 || slides.length === 0) return;
      const index = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
      onIndexChange(Math.min(Math.max(index, 0), slides.length - 1));
    },
    [pageWidth, slides.length, onIndexChange],
  );

  return (
    <Animated.ScrollView
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={handleScroll}
      onMomentumScrollEnd={handleMomentumEnd}
      style={pageStyle}
    >
      {slides.map(
        (slide: OnboardingSlide): ReactElement => (
          <View key={slide.key} style={pageStyle}>
            <Image
              source={slide.image}
              style={imageStyle}
              contentFit="cover"
              contentPosition="center"
              accessible
              accessibilityRole="image"
              accessibilityLabel={slide.imageLabel}
            />
          </View>
        ),
      )}
    </Animated.ScrollView>
  );
}
