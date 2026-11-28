import { useRouter } from 'expo-router';
import { type ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { type LayoutChangeEvent, useWindowDimensions, View, type ViewStyle } from 'react-native';
import Animated, {
  clamp,
  type DerivedValue,
  Easing,
  Extrapolation,
  interpolate,
  ReduceMotion,
  type SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Lobe } from '@/components/common/Lobe';
import { Text } from '@/components/common/Text';
import { BrandLockup, useLockupLayout } from '@/components/onboarding/BrandLockup';
import { OnboardingIsland } from '@/components/onboarding/OnboardingIsland';
import { OnboardingMap } from '@/components/onboarding/OnboardingMap';
import { OnboardingStage } from '@/components/onboarding/OnboardingStage';
import {
  EASE_IN_OUT,
  EASE_OUT,
  ONBOARDING_LOBES,
  ONBOARDING_SLIDES,
  type OnboardingSlide,
} from '@/constants/onboarding';
import { Routes } from '@/constants/routes';
import { Colors } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import { useSplashStore } from '@/store/splash.store';

/** Gap between the lockup header and the caption block, dp. */
const CAPTION_GAP: number = 8;

/** Caption block height at the default type size, dp; scaled by the font scale. */
const CAPTION_HEIGHT: number = 56;

/** Height of the fade that softens the map's top edge, dp. */
const TOP_FADE_HEIGHT: number = 64;

/** How far above the island the bottom fade starts, dp. */
const FADE_LEAD: number = 24;

/** Depth into the bottom fade at which it reaches the solid background, dp. */
const FADE_SOLID_DEPTH: number = 72;

/** How far below the island top the cut-outs' bottom edge sits, dp. */
const CUTOUT_BELOW_ISLAND: number = 48;

/** Island height assumed until its first layout reports, dp. */
const ISLAND_FALLBACK_HEIGHT: number = 196;

/** Side and bottom margin of the island, dp. */
const ISLAND_MARGIN: number = 16;

/** Length of the full entrance clock, ms. */
const ENTRANCE_MS: number = 2400;

/** Length of the single reduced-motion fade, ms. */
const REDUCED_FADE_MS: number = 150;

/** How long to wait for the logo to report that it drew before starting anyway, ms. */
const REVEAL_FALLBACK_MS: number = 600;

/** The root clips the lobes; edge to edge, no safe-area padding. */
const ROOT_STYLE = { overflow: 'hidden' } as const satisfies ViewStyle;

/** Each caption sits on top of the others, so the block never reflows while swiping. */
const CAPTION_OVERLAY_STYLE = { position: 'absolute', top: 0, left: 0, right: 0 } as const satisfies ViewStyle;

const [topRightLobe, bottomLeftLobe] = ONBOARDING_LOBES;

/**
 * Eased progress of one entrance window on the clock, from 0 before `start` to 1 after `end`.
 *
 * @param t - The clock, ms
 * @param start - When the window opens, ms
 * @param end - When the window closes, ms
 * @param ease - Curve applied to the linear progress
 * @returns Eased progress between 0 and 1
 */
function windowProgress(t: number, start: number, end: number, ease: (value: number) => number): number {
  'worklet';
  return ease(clamp((t - start) / (end - start), 0, 1));
}

/**
 * Progress of the one reduced-motion fade every element shares.
 *
 * @param t - The clock, ms
 * @returns Linear progress between 0 and 1
 */
function reducedFade(t: number): number {
  'worklet';
  return clamp(t / REDUCED_FADE_MS, 0, 1);
}

/** Props for {@link Caption}. */
interface CaptionProps {
  slide: OnboardingSlide;
  index: number;
  scrollX: SharedValue<number>;
  pageWidth: number;
  /** Entrance opacity of the caption block. */
  entrance: DerivedValue<number>;
  /** Whether this is the slide the pager settled on; only that caption reaches screen readers. */
  settled: boolean;
}

/**
 * One slide's caption, faded in as its page nears the centre and out as it leaves.
 */
function Caption({ slide, index, scrollX, pageWidth, entrance, settled }: CaptionProps): ReactElement {
  const motion = useAnimatedStyle((): ViewStyle => {
    const position = pageWidth > 0 ? scrollX.get() / pageWidth : 0;
    const visible = interpolate(position, [index - 0.5, index, index + 0.5], [0, 1, 0], Extrapolation.CLAMP);
    return { opacity: visible * entrance.get() };
  });

  return (
    <Animated.View
      accessibilityElementsHidden={!settled}
      importantForAccessibility={settled ? 'yes' : 'no-hide-descendants'}
      style={[CAPTION_OVERLAY_STYLE, motion]}
    >
      <Text className="text-body-xl text-foreground text-center">{slide.caption}</Text>
    </Animated.View>
  );
}

/**
 * Public Welcome screen shown to signed-out users: the brand lockup settles into the header, the map
 * draws in behind the swipeable cut-out stage, and the glass island offers Get started and Log in.
 * Both actions open the login screen. Under reduced motion the lockup starts settled and everything
 * else shares one short fade.
 *
 * @returns The Welcome screen.
 */
export default function WelcomeScreen(): ReactElement {
  const router = useRouter();
  const theme = useResolvedTheme();
  const insets = useSafeAreaInsets();
  const lockup = useLockupLayout();
  const reduced = useReducedMotion();
  const { width, height, fontScale } = useWindowDimensions();

  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [islandTop, setIslandTop] = useState<number | null>(null);
  /** True once the lockup has drawn: the root splash lifts and the entrance clock starts. */
  const [shown, setShown] = useState<boolean>(false);
  const setWelcomeShown = useSplashStore((state) => state.setWelcomeShown);

  const scrollX = useSharedValue<number>(0);
  const clock = useSharedValue<number>(0);

  /** Waits two frames after the logo reports, so its bitmap is on screen before the root splash lifts. */
  const reveal = useCallback((): void => {
    requestAnimationFrame((): void => {
      requestAnimationFrame((): void => {
        setShown(true);
      });
    });
  }, []);

  useEffect((): (() => void) => {
    const fallback = setTimeout(reveal, REVEAL_FALLBACK_MS);
    return (): void => {
      clearTimeout(fallback);
    };
  }, [reveal]);

  useEffect((): (() => void) | undefined => {
    if (!shown) return undefined;
    const duration = reduced ? REDUCED_FADE_MS : ENTRANCE_MS;
    setWelcomeShown(true);
    clock.set(withTiming(duration, { duration, easing: Easing.linear, reduceMotion: ReduceMotion.Never }));
    return (): void => {
      setWelcomeShown(false);
    };
  }, [shown, clock, reduced, setWelcomeShown]);

  const bandTop = lockup.headerBottom + CAPTION_GAP + CAPTION_HEIGHT * fontScale;
  const bandHeight = Math.max(height - bandTop, 0);
  const resolvedIslandTop = islandTop ?? height - insets.bottom - ISLAND_MARGIN - ISLAND_FALLBACK_HEIGHT;
  const bottomInset = Math.max(height - (resolvedIslandTop + CUTOUT_BELOW_ISLAND), 0);
  const fadeTop = resolvedIslandTop - FADE_LEAD;

  const lockupProgress = useDerivedValue((): number =>
    reduced ? 1 : windowProgress(clock.get(), 450, 1050, EASE_IN_OUT),
  );
  const intro = useDerivedValue((): number => (reduced ? 1 : windowProgress(clock.get(), 1300, 2400, EASE_IN_OUT)));
  const captionEntrance = useDerivedValue((): number =>
    reduced ? reducedFade(clock.get()) : windowProgress(clock.get(), 900, 1100, EASE_OUT),
  );

  const mapMotion = useAnimatedStyle(
    (): ViewStyle => ({
      opacity: reduced ? reducedFade(clock.get()) : windowProgress(clock.get(), 700, 1100, EASE_OUT),
    }),
  );

  const stageMotion = useAnimatedStyle((): ViewStyle => {
    if (reduced) return { opacity: reducedFade(clock.get()) };
    const progress = windowProgress(clock.get(), 800, 1300, EASE_OUT);
    return { opacity: progress, transform: [{ translateY: 32 * (1 - progress) }] };
  });

  const islandMotion = useAnimatedStyle((): ViewStyle => {
    if (reduced) return { opacity: reducedFade(clock.get()) };
    const progress = windowProgress(clock.get(), 950, 1350, EASE_OUT);
    return { opacity: progress, transform: [{ translateY: 24 * (1 - progress) }] };
  });

  const bandStyle = useMemo(
    (): ViewStyle => ({ position: 'absolute', top: bandTop, left: 0, width, height: bandHeight }),
    [bandTop, width, bandHeight],
  );

  const topFadeStyle = useMemo((): ViewStyle => {
    const background = Colors[theme].background;
    return {
      position: 'absolute',
      top: bandTop,
      left: 0,
      right: 0,
      height: TOP_FADE_HEIGHT,
      experimental_backgroundImage: `linear-gradient(180deg, ${background} 0%, transparent 100%)`,
      experimental_backgroundRepeat: 'no-repeat',
    };
  }, [theme, bandTop]);

  const bottomFadeStyle = useMemo((): ViewStyle => {
    const background = Colors[theme].background;
    const fadeHeight = Math.max(height - fadeTop, 1);
    const solidStop = Math.round(Math.min((FADE_SOLID_DEPTH / fadeHeight) * 100, 100) * 100) / 100;
    return {
      position: 'absolute',
      top: fadeTop,
      left: 0,
      right: 0,
      bottom: 0,
      experimental_backgroundImage: `linear-gradient(180deg, transparent 0%, ${background} ${solidStop}%, ${background} 100%)`,
      experimental_backgroundRepeat: 'no-repeat',
    };
  }, [theme, height, fadeTop]);

  const captionBlockStyle = useMemo(
    (): ViewStyle => ({
      position: 'absolute',
      top: lockup.headerBottom + CAPTION_GAP,
      left: 0,
      right: 0,
      paddingHorizontal: 32,
      minHeight: CAPTION_HEIGHT * fontScale,
    }),
    [lockup.headerBottom, fontScale],
  );

  const islandFrameStyle = useMemo(
    (): ViewStyle => ({
      position: 'absolute',
      left: ISLAND_MARGIN,
      right: ISLAND_MARGIN,
      bottom: insets.bottom + ISLAND_MARGIN,
    }),
    [insets.bottom],
  );

  const handleIslandLayout = useCallback((event: LayoutChangeEvent): void => {
    setIslandTop(event.nativeEvent.layout.y);
  }, []);

  const openLogin = useCallback((): void => {
    router.push(Routes.auth.login);
  }, [router]);

  return (
    <View className="flex-1 bg-background" style={ROOT_STYLE}>
      <Lobe {...topRightLobe} />
      <Lobe {...bottomLeftLobe} />

      <Animated.View pointerEvents="none" style={[bandStyle, mapMotion]}>
        <OnboardingMap
          scrollX={scrollX}
          pageWidth={width}
          height={bandHeight}
          intro={intro}
          activeIndex={activeIndex}
        />
      </Animated.View>

      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={topFadeStyle}
      />

      <Animated.View style={[bandStyle, stageMotion]}>
        <OnboardingStage
          slides={ONBOARDING_SLIDES}
          scrollX={scrollX}
          pageWidth={width}
          height={bandHeight}
          bottomInset={bottomInset}
          onIndexChange={setActiveIndex}
        />
      </Animated.View>

      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={bottomFadeStyle}
      />

      <BrandLockup progress={lockupProgress} onLogoDisplay={reveal} />

      <View pointerEvents="none" style={captionBlockStyle}>
        {ONBOARDING_SLIDES.map(
          (slide: OnboardingSlide, index: number): ReactElement => (
            <Caption
              key={slide.key}
              slide={slide}
              index={index}
              scrollX={scrollX}
              pageWidth={width}
              entrance={captionEntrance}
              settled={index === activeIndex}
            />
          ),
        )}
      </View>

      <Animated.View onLayout={handleIslandLayout} style={[islandFrameStyle, islandMotion]}>
        <OnboardingIsland
          scrollX={scrollX}
          pageWidth={width}
          pageCount={ONBOARDING_SLIDES.length}
          onGetStarted={openLogin}
          onLogIn={openLogin}
        />
      </Animated.View>
    </View>
  );
}
