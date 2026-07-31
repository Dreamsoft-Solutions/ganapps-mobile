import { Image } from 'expo-image';
import type { ReactElement } from 'react';
import { useColorScheme, View } from 'react-native';
import { Assets } from '@/constants/assets';
import { useThemeStore } from '@/store/theme.store';

interface LogoWithTextProps {
  width?: number;
  height?: number;
}

/**
 * Theme-aware logo with "Ganapps" wordmark.
 *
 * Shows the green-text variant on light backgrounds and the white-text variant
 * on dark backgrounds, respecting the user's stored theme preference and the
 * device color scheme.
 *
 * @param props - Optional width and height (both default to 192 and 64).
 * @returns An image sized to the given dimensions.
 */
export function LogoWithText({ width = 192, height = 64 }: LogoWithTextProps): ReactElement {
  const mode = useThemeStore((s) => s.mode);
  const systemColorScheme = useColorScheme();
  const isDark = mode === 'dark' || (mode === 'system' && systemColorScheme === 'dark');

  return (
    <View style={{ width, height }}>
      <Image
        source={isDark ? Assets.logoDarkText : Assets.logoLightText}
        style={{ width, height }}
        contentFit="contain"
        accessibilityLabel="Ganapps"
      />
    </View>
  );
}
