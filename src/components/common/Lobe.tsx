import { useMemo, type ReactElement } from 'react';
import { View, type ViewStyle } from 'react-native';

import { Colors } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';

/** Props for {@link Lobe}. Offsets are layout offsets in dp and may be negative. */
export interface LobeProps {
  /** Diameter in dp. */
  size: number;
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
  /** Defaults to 1. */
  opacity?: number;
}

/**
 * Draws one static background glow: a soft green-to-lime radial lobe, absolutely positioned and
 * hidden from touch and screen readers. The parent clips it (`overflow: 'hidden'`).
 *
 * @example
 * <View className="flex-1 overflow-hidden bg-background">
 *   <Lobe size={460} top={-230} right={-210} />
 * </View>
 *
 * @param props - Diameter, position offsets and opacity of the lobe.
 * @returns The decorative lobe.
 */
export function Lobe({ size, top, right, bottom, left, opacity = 1 }: LobeProps): ReactElement {
  const theme = useResolvedTheme();

  const style = useMemo((): ViewStyle => {
    const colors = Colors[theme];
    return {
      position: 'absolute',
      top,
      right,
      bottom,
      left,
      width: size,
      height: size,
      borderRadius: size / 2,
      opacity,
      experimental_backgroundImage: `radial-gradient(circle at 50% 50%, ${colors.glow} 0%, ${colors['glow-lime']} 38%, transparent 70%)`,
      experimental_backgroundRepeat: 'no-repeat',
    };
  }, [theme, size, top, right, bottom, left, opacity]);

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={style}
    />
  );
}
