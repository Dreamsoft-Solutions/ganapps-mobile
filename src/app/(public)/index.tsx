import { useRouter } from 'expo-router';
import { type ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';
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
import { LogoWithText } from '@/components/common/LogoWithText';
import { Text } from '@/components/common/Text';
import { BrandLockup } from '@/components/onboarding/BrandLockup';
import { OnboardingSignIn } from '@/components/onboarding/OnboardingSignIn';
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
import { useAuth } from '@/hooks/useAuth';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import { useSocialSignIn } from '@/hooks/useSocialSignIn';
import { useSplashStore } from '@/store/splash.store';
import { mix } from '@/utils/color-mix';

/** Width and height of the wordmark logo in the header, dp. */
const LOGO_WIDTH: number = 132;
const LOGO_HEIGHT: number = 51;

/** Gap between the safe-area top and the wordmark logo, dp. */
const LOGO_TOP_GAP: number = 16;

/** How far below the logo the top scrim runs before it is clear, dp. */
const TOP_SCRIM_TAIL: number = 96;

/**
 * Copy height at the default type size: two `headline-lg` lines, the gap and two `body-md` lines,
 * dp; scaled by the font scale.
 */
const HEADLINE_HEIGHT: number = 128;

/** How far above the sign-in block the bottom scrim starts, dp. */
const BOTTOM_SCRIM_LEAD: number = 140;

/** Sign-in block height assumed until its first layout reports, dp. */
const BLOCK_FALLBACK_HEIGHT: number = 340;

/** Side and bottom margin of the sign-in block, dp. */
const BLOCK_MARGIN: number = 16;

/** The stops of the two scrims, top to bottom. */
type ScrimStop = 'top' | 'logo' | 'headline' | 'copy' | 'buttons' | 'legal' | 'bottom';

/** Length of the full entrance clock, ms. */
const ENTRANCE_MS: number = 1400;

/** Length of the single reduced-motion fade, ms. */
const REDUCED_FADE_MS: number = 150;

/** How long to wait for the logo to report that it drew before starting anyway, ms. */
const REVEAL_FALLBACK_MS: number = 600;

/**
 * How much of the theme background each scrim lays over the photo, percent, at its stops. Each
 * value is the least that keeps the text at that stop at 4.5:1 (3:1 for the headline) over the
 * worst photo for the theme (black under dark ink, white under light ink), plus a margin, so the
 * contrast holds whatever photo is swapped in. The buttons are opaque, so the veil behind them is
 * thinner and the photo shows through there.
 */
const SCRIM = {
  light: { top: 68, logo: 60, headline: 50, copy: 60, buttons: 66, legal: 86, bottom: 90 },
  dark: { top: 80, logo: 72, headline: 60, copy: 70, buttons: 74, legal: 84, bottom: 90 },
} as const satisfies Record<'light' | 'dark', Record<ScrimStop, number>>;

/** Where each bottom-scrim stop sits below the top of the sign-in block, dp. */
const SCRIM_OFFSET = { copy: 90, buttons: 180, legal: 245 } as const;

/** The root clips the lobes and the settling photo; edge to edge, no safe-area padding. */
const ROOT_STYLE = { overflow: 'hidden' } as const satisfies ViewStyle;

/** Each headline sits on top of the others, so the block never reflows while swiping. */
const HEADLINE_OVERLAY_STYLE = { position: 'absolute', top: 0, left: 0, right: 0 } as const satisfies ViewStyle;

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

/** Props for {@link Headline}. */
interface HeadlineProps {
  slide: OnboardingSlide;
  index: number;
  scrollX: SharedValue<number>;
  pageWidth: number;
  /** Whether this is the slide the pager settled on; only that headline reaches screen readers. */
  settled: boolean;
}

/**
 * One slide's headline and supporting line, faded in as its photo nears the centre and out as it
 * leaves.
 */
function Headline({ slide, index, scrollX, pageWidth, settled }: HeadlineProps): ReactElement {
  const motion = useAnimatedStyle((): ViewStyle => {
    const position = pageWidth > 0 ? scrollX.get() / pageWidth : 0;
    return { opacity: interpolate(position, [index - 0.5, index, index + 0.5], [0, 1, 0], Extrapolation.CLAMP) };
  });

  return (
    <Animated.View
      accessibilityElementsHidden={!settled}
      importantForAccessibility={settled ? 'yes' : 'no-hide-descendants'}
      style={[HEADLINE_OVERLAY_STYLE, motion]}
    >
      <Text accessibilityRole="header" className="text-headline-lg font-allo-bold text-foreground text-center">
        {slide.caption}
      </Text>
      <Text className="mt-xs text-body-md text-foreground text-center">{slide.body}</Text>
    </Animated.View>
  );
}

/**
 * Public Welcome screen shown to signed-out users. A full-screen photo per slide sits behind
 * everything, with the phone in it on the screen's centre; the wordmark is at the top, and the
 * slide headline and the ways in (Apple, Google, email, log in) sit over the bottom scrim. The
 * screen opens in the splash composition and settles from it: the lockup lifts and fades as the
 * photo, the wordmark and the sign-in block arrive. Under reduced motion everything shares one
 * short fade.
 *
 * @returns The Welcome screen.
 */
export default function WelcomeScreen(): ReactElement {
  const router = useRouter();
  const theme = useResolvedTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { width, height, fontScale } = useWindowDimensions();
  const social = useSocialSignIn(useAuth());

  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [blockTop, setBlockTop] = useState<number | null>(null);
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

  const logoTop = insets.top + LOGO_TOP_GAP;
  const resolvedBlockTop = blockTop ?? height - insets.bottom - BLOCK_MARGIN - BLOCK_FALLBACK_HEIGHT;
  const bottomScrimTop = Math.max(resolvedBlockTop - BOTTOM_SCRIM_LEAD, 0);

  const lockupProgress: DerivedValue<number> = useDerivedValue((): number =>
    reduced ? 0 : windowProgress(clock.get(), 450, 950, EASE_IN_OUT),
  );

  const lockupMotion = useAnimatedStyle(
    (): ViewStyle => ({
      opacity: reduced ? 1 - reducedFade(clock.get()) : 1 - windowProgress(clock.get(), 700, 950, EASE_OUT),
    }),
  );

  const stageMotion = useAnimatedStyle((): ViewStyle => {
    if (reduced) return { opacity: reducedFade(clock.get()) };
    const progress = windowProgress(clock.get(), 600, 1150, EASE_OUT);
    return { opacity: progress, transform: [{ scale: 1.06 - 0.06 * progress }] };
  });

  const logoMotion = useAnimatedStyle(
    (): ViewStyle => ({
      opacity: reduced ? reducedFade(clock.get()) : windowProgress(clock.get(), 850, 1150, EASE_OUT),
    }),
  );

  const blockMotion = useAnimatedStyle((): ViewStyle => {
    if (reduced) return { opacity: reducedFade(clock.get()) };
    const progress = windowProgress(clock.get(), 800, 1300, EASE_OUT);
    return { opacity: progress, transform: [{ translateY: 24 * (1 - progress) }] };
  });

  const topScrimStyle = useMemo((): ViewStyle => {
    const background = Colors[theme].background;
    const veil = SCRIM[theme];
    const scrimHeight = logoTop + LOGO_HEIGHT + TOP_SCRIM_TAIL;
    const solidStop = Math.round(((logoTop + LOGO_HEIGHT + 8) / scrimHeight) * 100);
    return {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: scrimHeight,
      experimental_backgroundImage: `linear-gradient(180deg, ${mix(background, veil.top)} 0%, ${mix(background, veil.logo)} ${solidStop}%, ${mix(background, 0)} 100%)`,
      experimental_backgroundRepeat: 'no-repeat',
    };
  }, [theme, logoTop]);

  const bottomScrimStyle = useMemo((): ViewStyle => {
    const background = Colors[theme].background;
    const veil = SCRIM[theme];
    const scrimHeight = Math.max(height - bottomScrimTop, 1);
    const stop = (offset: number): number =>
      Math.round(Math.min(((BOTTOM_SCRIM_LEAD + offset) / scrimHeight) * 100, 100));
    return {
      position: 'absolute',
      top: bottomScrimTop,
      left: 0,
      right: 0,
      bottom: 0,
      experimental_backgroundImage: `linear-gradient(180deg, ${mix(background, 0)} 0%, ${mix(background, veil.headline)} ${stop(0)}%, ${mix(background, veil.copy)} ${stop(SCRIM_OFFSET.copy)}%, ${mix(background, veil.buttons)} ${stop(SCRIM_OFFSET.buttons)}%, ${mix(background, veil.legal)} ${stop(SCRIM_OFFSET.legal)}%, ${mix(background, veil.bottom)} 100%)`,
      experimental_backgroundRepeat: 'no-repeat',
    };
  }, [theme, height, bottomScrimTop]);

  const logoFrameStyle = useMemo(
    (): ViewStyle => ({ position: 'absolute', top: logoTop, left: 0, right: 0, alignItems: 'center' }),
    [logoTop],
  );

  const blockFrameStyle = useMemo(
    (): ViewStyle => ({
      position: 'absolute',
      left: BLOCK_MARGIN,
      right: BLOCK_MARGIN,
      bottom: insets.bottom + BLOCK_MARGIN,
    }),
    [insets.bottom],
  );

  const headlineBlockStyle = useMemo(
    (): ViewStyle => ({ minHeight: HEADLINE_HEIGHT * fontScale, marginBottom: 12 }),
    [fontScale],
  );

  const handleBlockLayout = useCallback((event: LayoutChangeEvent): void => {
    setBlockTop(event.nativeEvent.layout.y);
  }, []);

  const openSignUp = useCallback((): void => {
    router.push(Routes.auth.signup);
  }, [router]);

  const openLogIn = useCallback((): void => {
    router.push(Routes.auth.login);
  }, [router]);

  return (
    <View className="flex-1 bg-background" style={ROOT_STYLE}>
      <Lobe {...topRightLobe} />
      <Lobe {...bottomLeftLobe} />

      <Animated.View style={[StyleSheet.absoluteFill, stageMotion]}>
        <OnboardingStage
          slides={ONBOARDING_SLIDES}
          scrollX={scrollX}
          pageWidth={width}
          height={height}
          onIndexChange={setActiveIndex}
        />
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={topScrimStyle}
        />
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={bottomScrimStyle}
        />
      </Animated.View>

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, lockupMotion]}>
        <BrandLockup progress={lockupProgress} onLogoDisplay={reveal} />
      </Animated.View>

      <Animated.View pointerEvents="none" style={[logoFrameStyle, logoMotion]}>
        <LogoWithText width={LOGO_WIDTH} height={LOGO_HEIGHT} />
      </Animated.View>

      <Animated.View pointerEvents="box-none" onLayout={handleBlockLayout} style={[blockFrameStyle, blockMotion]}>
        <View pointerEvents="none" style={headlineBlockStyle}>
          {ONBOARDING_SLIDES.map(
            (slide: OnboardingSlide, index: number): ReactElement => (
              <Headline
                key={slide.key}
                slide={slide}
                index={index}
                scrollX={scrollX}
                pageWidth={width}
                settled={index === activeIndex}
              />
            ),
          )}
        </View>

        <OnboardingSignIn
          scrollX={scrollX}
          pageWidth={width}
          pageCount={ONBOARDING_SLIDES.length}
          social={social}
          onSignUpWithEmail={openSignUp}
          onLogIn={openLogIn}
        />
      </Animated.View>
    </View>
  );
}
