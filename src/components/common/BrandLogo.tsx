import { Image } from 'expo-image';
import { useMemo, type ReactElement } from 'react';
import { View, type ImageStyle, type ViewStyle } from 'react-native';

import { Assets } from '@/constants/assets';
import { Colors } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';

/** Width of the `logoRound` canvas in px. */
const LOGO_CANVAS = 1080;
/** Diameter of the navy disc inside the `logoRound` canvas in px. */
const LOGO_DISC = 726;
/** Halo diameter as a multiple of the disc. */
const HALO_SCALE = 2.4;

/** Props for {@link BrandLogo}. */
export interface BrandLogoProps {
  /** Visible diameter of the navy disc in dp. */
  size: number;
  /** Adds the green halo behind the mark. Once per screen, splash and Welcome only. Defaults to false. */
  glow?: boolean;
}

/**
 * Draws the round Ganapps mark so its navy disc fills a `size` by `size` box. The PNG carries
 * transparent padding, so the image is drawn larger and centred, overflowing the box. The optional
 * halo sits behind it without changing the layout box. The mark is never tinted or outlined.
 *
 * @example
 * <BrandLogo size={72} glow />
 */
export function BrandLogo({ size, glow = false }: BrandLogoProps): ReactElement {
  const theme = useResolvedTheme();

  const boxStyle = useMemo((): ViewStyle => ({ width: size, height: size }), [size]);

  const imageStyle = useMemo((): ImageStyle => {
    const drawn = (size * LOGO_CANVAS) / LOGO_DISC;
    const offset = (size - drawn) / 2;
    return { position: 'absolute', top: offset, left: offset, width: drawn, height: drawn };
  }, [size]);

  const haloStyle = useMemo((): ViewStyle => {
    const colors = Colors[theme];
    const halo = size * HALO_SCALE;
    const offset = (size - halo) / 2;
    return {
      position: 'absolute',
      top: offset,
      left: offset,
      width: halo,
      height: halo,
      borderRadius: halo / 2,
      experimental_backgroundImage: `radial-gradient(circle at 50% 50%, ${colors['primary-glow']} 0%, ${colors['glow-lime']} 45%, transparent 70%)`,
      experimental_backgroundRepeat: 'no-repeat',
    };
  }, [size, theme]);

  return (
    <View style={boxStyle}>
      {glow ? (
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={haloStyle}
        />
      ) : null}
      <Image
        source={Assets.logoRound}
        contentFit="contain"
        accessible
        accessibilityLabel="Ganapps logo"
        accessibilityRole="image"
        style={imageStyle}
      />
    </View>
  );
}
