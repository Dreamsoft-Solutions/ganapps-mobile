import { useMemo, type ReactElement } from 'react';
import { useWindowDimensions, View, type ViewStyle } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type DerivedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/common/BrandLogo';
import { Text } from '@/components/common/Text';
import { BRAND_NAME, BRAND_TAGLINE, HEADER_LOGO_SIZE, SPLASH_LOGO_SIZE } from '@/constants/onboarding';
import { Colors } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import { mix } from '@/utils/color-mix';

/** Gap between the safe-area top and the header logo, dp. */
const HEADER_TOP_GAP = 20;
/** Gap between the logo disc and the title at rest, dp. */
const TITLE_GAP = 12;
/** Gap between the title and the tagline, dp. */
const TAGLINE_GAP = 6;
/** Horizontal inset of the title block, the `lg` spacing token, dp. */
const TITLE_INSET = 24;
/** Line height of the `display` type style at font scale 1, dp. */
const DISPLAY_LINE_HEIGHT = 44;
/** Scale that takes the splash-sized logo down to the header size. */
const HEADER_SCALE: number = HEADER_LOGO_SIZE / SPLASH_LOGO_SIZE;
/** Diameter of the splash-only lime halo, dp. */
const SPLASH_GLOW_SIZE: number = SPLASH_LOGO_SIZE * 2.6;
/** Offset that centres the splash halo on the logo box, dp. */
const SPLASH_GLOW_OFFSET: number = (SPLASH_LOGO_SIZE - SPLASH_GLOW_SIZE) / 2;
/** Places the tagline under the title. */
const TAGLINE_STYLE: ViewStyle = { marginTop: TAGLINE_GAP };

/** Where the lockup sits, derived from the window, the safe area and the text size setting. */
export interface LockupLayout {
  /** Top of the header logo from the window top: `insets.top + 20`. */
  readonly headerTop: number;
  /** Bottom of the title at rest in the header, from the window top. */
  readonly headerBottom: number;
  /** translateY that takes the logo centre from its header rest to the window centre. */
  readonly splashShift: number;
}

/**
 * Computes the lockup geometry for the current window, safe area and font scale. Screens that
 * place content under the header read `headerBottom` from here so they track the lockup exactly.
 *
 * @returns The header top, the title bottom at rest and the splash shift, in dp.
 * @example
 * const { headerBottom } = useLockupLayout();
 * const bandTop = headerBottom + 8;
 */
export function useLockupLayout(): LockupLayout {
  const { height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return useMemo((): LockupLayout => {
    const headerTop = insets.top + HEADER_TOP_GAP;
    return {
      headerTop,
      headerBottom: headerTop + HEADER_LOGO_SIZE + TITLE_GAP + DISPLAY_LINE_HEIGHT * fontScale,
      splashShift: height / 2 - (headerTop + HEADER_LOGO_SIZE / 2),
    };
  }, [height, fontScale, insets.top]);
}

/** Props for {@link BrandLockup}. */
export interface BrandLockupProps {
  /** 0 is the splash composition, 1 is the Welcome header. */
  progress: SharedValue<number> | DerivedValue<number>;
}

/**
 * The logo, wordmark and tagline shared by the splash and Welcome, so their geometry cannot drift.
 * At progress 0 the logo is centred in the window at splash size with the lime halo and tagline;
 * at progress 1 it rests in the Welcome header. Every value is a linear interpolation of
 * `progress`; the caller eases it and owns reduced motion. Transform and opacity only.
 *
 * @example
 * const progress = useSharedValue(0);
 * progress.set(withTiming(1, { duration: 600, easing: EASE_IN_OUT }));
 * <BrandLockup progress={progress} />
 */
export function BrandLockup({ progress }: BrandLockupProps): ReactElement {
  const theme = useResolvedTheme();
  const { height } = useWindowDimensions();
  const { headerTop, splashShift } = useLockupLayout();

  const rootStyle = useMemo((): ViewStyle => ({ position: 'absolute', top: 0, left: 0, right: 0, height }), [height]);

  const logoRowStyle = useMemo(
    (): ViewStyle => ({
      position: 'absolute',
      left: 0,
      right: 0,
      top: headerTop + HEADER_LOGO_SIZE / 2 - SPLASH_LOGO_SIZE / 2,
      alignItems: 'center',
    }),
    [headerTop],
  );

  const titleBlockStyle = useMemo(
    (): ViewStyle => ({
      position: 'absolute',
      left: 0,
      right: 0,
      top: headerTop + HEADER_LOGO_SIZE + TITLE_GAP,
      paddingHorizontal: TITLE_INSET,
    }),
    [headerTop],
  );

  const splashGlowStyle = useMemo((): ViewStyle => {
    const colors = Colors[theme];
    return {
      position: 'absolute',
      top: SPLASH_GLOW_OFFSET,
      left: SPLASH_GLOW_OFFSET,
      width: SPLASH_GLOW_SIZE,
      height: SPLASH_GLOW_SIZE,
      borderRadius: SPLASH_GLOW_SIZE / 2,
      experimental_backgroundImage: `radial-gradient(circle at 50% 50%, ${mix(colors['brand-lime'], 45)} 0%, transparent 68%)`,
      experimental_backgroundRepeat: 'no-repeat',
    };
  }, [theme]);

  const titleShift = splashShift + (SPLASH_LOGO_SIZE - HEADER_LOGO_SIZE) / 2 + TITLE_GAP;

  const logoMotion = useAnimatedStyle((): ViewStyle => {
    const p = progress.get();
    return {
      transform: [
        { translateY: interpolate(p, [0, 1], [splashShift, 0], Extrapolation.CLAMP) },
        { scale: interpolate(p, [0, 1], [1, HEADER_SCALE], Extrapolation.CLAMP) },
      ],
    };
  });

  const splashGlowMotion = useAnimatedStyle(
    (): ViewStyle => ({
      opacity: interpolate(progress.get(), [0, 0.6], [1, 0], Extrapolation.CLAMP),
    }),
  );

  const titleMotion = useAnimatedStyle(
    (): ViewStyle => ({
      transform: [{ translateY: interpolate(progress.get(), [0, 1], [titleShift, 0], Extrapolation.CLAMP) }],
    }),
  );

  const taglineMotion = useAnimatedStyle(
    (): ViewStyle => ({
      opacity: interpolate(progress.get(), [0, 0.25], [1, 0], Extrapolation.CLAMP),
    }),
  );

  return (
    <View pointerEvents="none" style={rootStyle}>
      <Animated.View style={[logoRowStyle, logoMotion]}>
        <View>
          <Animated.View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[splashGlowStyle, splashGlowMotion]}
          />
          <BrandLogo size={SPLASH_LOGO_SIZE} glow />
        </View>
      </Animated.View>
      <Animated.View style={[titleBlockStyle, titleMotion]}>
        <Text className="text-display font-allo-bold text-foreground text-center">{BRAND_NAME}</Text>
        <Animated.View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[TAGLINE_STYLE, taglineMotion]}
        >
          <Text className="text-body-md text-muted-foreground text-center">{BRAND_TAGLINE}</Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}
