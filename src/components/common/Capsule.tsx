import { useMemo, type ReactElement } from 'react';
import { View, type ViewProps, type ViewStyle } from 'react-native';

import { BorderRadius, Colors, Shadows } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import { mix } from '@/utils/color-mix';

/** Which colour the capsule is cut from. */
export type CapsuleTone = 'primary' | 'secondary' | 'destructive' | 'muted' | 'card';

/** Props for {@link Capsule}. Layout classes from the caller land on the view. */
export interface CapsuleProps extends ViewProps {
  /** Colour the capsule is cut from. Defaults to `'primary'`. */
  tone?: CapsuleTone;
  /** Corner radius in dp. Defaults to `BorderRadius.full`. */
  radius?: number;
  /** Draws the pressed bezel instead of the resting one. */
  pressed?: boolean;
  /** Adds the soft drop glow under a resting capsule. Defaults to `true`. */
  glow?: boolean;
}

/**
 * Draws the Ganapps Capsule: a solid pill lit from above, with a shoulder sheen, a lighter ring and a
 * bezel. Light runs from a lightened top edge to a darkened bottom edge of the tone colour. A resting
 * capsule adds a soft glow in its own colour; a pressed one swaps the bezel for the pressed bezel and
 * drops the glow.
 *
 * @example
 * <Capsule tone="primary" className="min-h-touch flex-row items-center justify-center px-lg">
 *   <Text>Label</Text>
 * </Capsule>
 */
export function Capsule({
  tone = 'primary',
  radius = BorderRadius.full,
  pressed = false,
  glow = true,
  style,
  ...rest
}: CapsuleProps): ReactElement {
  const theme = useResolvedTheme();

  const material = useMemo((): ViewStyle => {
    const colors = Colors[theme];
    const shadows = Shadows[theme];
    const base = colors[tone];

    const sheen = `radial-gradient(140% 120% at 12% 0%, ${colors['bezel-sheen']} 0%, transparent 38%)`;
    const light = `linear-gradient(180deg, ${mix(base, 86, '#fff')} 0%, ${base} 46%, ${mix(base, 80, '#000')} 100%)`;
    const ring = `inset 0 0 0 1px ${mix(base, 60, colors['glass-ice'])}`;
    const lift = `0 14px 28px -14px ${mix(base, 85)}`;

    return {
      borderRadius: radius,
      backgroundColor: base,
      experimental_backgroundImage: `${sheen}, ${light}`,
      experimental_backgroundRepeat: 'no-repeat',
      boxShadow: pressed
        ? `${ring}, ${shadows['bezel-pressed']}`
        : [ring, shadows.bezel, ...(glow ? [lift] : [])].join(', '),
    };
  }, [theme, tone, radius, pressed, glow]);

  return <View {...rest} style={[material, style]} />;
}
