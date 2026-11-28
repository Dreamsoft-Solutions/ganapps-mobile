import { Image } from 'expo-image';
import { useCallback, useMemo, type ReactElement } from 'react';
import { type ImageStyle, type NativeScrollEvent, type NativeSyntheticEvent, View, type ViewStyle } from 'react-native';
import Animated, { type ScrollEvent, type SharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';

import { type OnboardingSlide, STAGE_ASPECT, STAGE_HEADROOM } from '@/constants/onboarding';

/** Props for {@link OnboardingStage}. */
export interface OnboardingStageProps {
  slides: readonly OnboardingSlide[];
  /** Written by the stage on every scroll frame. */
  scrollX: SharedValue<number>;
  pageWidth: number;
  /** Height of the band the stage fills, dp. */
  height: number;
  /** Distance from the band bottom up to where the cut-outs' bottom edge sits, dp. */
  bottomInset: number;
  /** Called once when the pager settles on a slide. */
  onIndexChange: (index: number) => void;
}

/**
 * How the cut-outs fit the room above `bottomInset`: at full size, cropped into the transparent
 * headroom, or shrunk and pinned to each slide's `shrinkPosition`.
 */
type StageFit = 'full' | 'crop' | 'shrink';

/** The fit and drawn height shared by every cut-out on the stage. */
interface StageSizing {
  readonly fit: StageFit;
  /** Height of each cut-out's frame, dp. */
  readonly imageHeight: number;
}

/**
 * Picks how the cut-outs are sized for the room left above `bottomInset`.
 *
 * @param pageWidth - Width of one page, dp
 * @param available - Height between the band top and the cut-outs' bottom edge, dp
 * @returns The fit and the frame height every cut-out uses
 */
function resolveSizing(pageWidth: number, available: number): StageSizing {
  const full = pageWidth / STAGE_ASPECT;
  if (available >= full) return { fit: 'full', imageHeight: full };
  if (available >= full * (1 - STAGE_HEADROOM)) return { fit: 'crop', imageHeight: available };
  return { fit: 'shrink', imageHeight: Math.max(available, 0) };
}

/**
 * The Welcome pager: one full-width page per slide, each holding a cut-out whose bottom edge sits
 * `bottomInset` above the band bottom. It writes the horizontal offset into `scrollX` on every frame
 * on the UI thread and reports the settled slide once momentum ends.
 *
 * @example
 * <OnboardingStage
 *   slides={ONBOARDING_SLIDES}
 *   scrollX={scrollX}
 *   pageWidth={width}
 *   height={bandHeight}
 *   bottomInset={120}
 *   onIndexChange={setActiveIndex}
 * />
 */
export function OnboardingStage({
  slides,
  scrollX,
  pageWidth,
  height,
  bottomInset,
  onIndexChange,
}: OnboardingStageProps): ReactElement {
  const sizing = useMemo(
    (): StageSizing => resolveSizing(pageWidth, height - bottomInset),
    [pageWidth, height, bottomInset],
  );

  /** The pager frame and each page share one size: a full page of the band. */
  const pageStyle = useMemo((): ViewStyle => ({ width: pageWidth, height }), [pageWidth, height]);

  const imageStyle = useMemo(
    (): ImageStyle => ({
      position: 'absolute',
      left: 0,
      bottom: bottomInset,
      width: pageWidth,
      height: sizing.imageHeight,
    }),
    [bottomInset, pageWidth, sizing.imageHeight],
  );

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
              contentFit={sizing.fit === 'shrink' ? 'contain' : 'cover'}
              contentPosition={sizing.fit === 'shrink' ? slide.shrinkPosition : 'bottom'}
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
