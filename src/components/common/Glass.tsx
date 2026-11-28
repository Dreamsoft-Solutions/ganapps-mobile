import { vars } from 'nativewind';
import { useMemo, type ReactElement } from 'react';
import { View, type ViewProps, type ViewStyle } from 'react-native';

import { BorderRadius, Colors, Rim, Shadows } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import { mix } from '@/utils/color-mix';

/** Which Glass recipe to draw: the base pane, a denser pane, a green-tinted pane or a flat solid one. */
export type GlassVariant = 'regular' | 'strong' | 'tint' | 'solid';

/** How far the pane stands off the page: a control, a floating island, or the full-width bar. */
export type GlassLift = 'glass' | 'island' | 'none';

/** Rim ring width by surface size, a key of `Rim`. */
export type RimWidth = keyof typeof Rim;

/** Props for {@link Glass}. Layout classes from the caller land on the outer view. */
export interface GlassProps extends ViewProps {
  /** Recipe to draw. Defaults to `'regular'`. */
  variant?: GlassVariant;
  /** Rim ring width. Defaults to `'md'`. */
  rim?: RimWidth;
  /** Elevation. `'none'` is the full-width bar: no rim, no radius, no shadow. Defaults to `'glass'`. */
  lift?: GlassLift;
  /** Corner radius in dp. Defaults to `BorderRadius.full`. */
  radius?: number;
  /** Draws the pressed bezel instead of the resting shadow. */
  pressed?: boolean;
}

/**
 * Splits a `boxShadow` string into its layers on commas that sit outside parentheses.
 *
 * @param shadow - A CSS `boxShadow` value, e.g. one of the `Shadows` tokens.
 * @returns Each layer, trimmed, in order.
 */
export function splitShadowLayers(shadow: string): string[] {
  const layers: string[] = [];
  let depth = 0;
  let start = 0;

  for (let index = 0; index < shadow.length; index += 1) {
    const char = shadow[index];
    if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
    } else if (char === ',' && depth === 0) {
      layers.push(shadow.slice(start, index).trim());
      start = index + 1;
    }
  }

  layers.push(shadow.slice(start).trim());
  return layers.filter((layer: string): boolean => layer.length > 0);
}

/**
 * Joins shadow layers into a `boxShadow` string, or `undefined` when there are none.
 */
function joinShadow(layers: readonly string[]): string | undefined {
  return layers.length > 0 ? layers.join(', ') : undefined;
}

/**
 * Draws the Ganapps Glass material: a rim ring (the outer view's gradient) around a body that carries
 * the fill, the tint, the top-left sweep and the mint return, with the active shadow split across the
 * two. Outset layers go on the outer view, inset layers on the body, so the inset ones are not hidden
 * by the rim. The body is the first child and ignores touches.
 *
 * The Solid tier is the only tier today; Liquid Glass (ganapps-home#280) and drawn blur (ganapps-home#281) slot in here.
 *
 * @example
 * <Glass variant="strong" rim="md" className="min-h-touch flex-row items-center justify-center px-lg">
 *   <Text>Label</Text>
 * </Glass>
 *
 * @param props - Recipe, rim, lift, radius and press state, plus view props and content.
 * @returns The glass pane with its content.
 */
export function Glass({
  variant = 'regular',
  rim = 'md',
  lift = 'glass',
  radius = BorderRadius.full,
  pressed = false,
  style,
  children,
  ...rest
}: GlassProps): ReactElement {
  const theme = useResolvedTheme();
  const flat = lift === 'none';

  const material = useMemo((): ViewStyle => {
    const colors = Colors[theme];
    const rimGradient = `linear-gradient(145deg, ${mix(colors['glass-ice'], 90)} 0%, ${colors['glass-rim']} 26%, ${mix(colors.mint, 16)} 62%, ${mix(colors.mint, 72)} 100%)`;
    const shadow = flat ? [] : splitShadowLayers(Shadows[theme][pressed ? 'bezel-pressed' : lift]);

    return {
      borderRadius: flat ? 0 : radius,
      experimental_backgroundImage: flat ? undefined : rimGradient,
      experimental_backgroundRepeat: 'no-repeat',
      boxShadow: joinShadow(shadow.filter((layer: string): boolean => !layer.startsWith('inset'))),
    };
  }, [theme, flat, radius, pressed, lift]);

  const body = useMemo((): ViewStyle => {
    const colors = Colors[theme];
    const inset = flat ? 0 : Rim[rim];
    const specular = variant === 'regular' ? colors['glass-highlight'] : mix(colors['glass-highlight'], 45);

    const tint = `linear-gradient(140deg, ${mix(colors['glass-ice'], 14)} 0%, ${mix(colors.mint, 6)} 42%, ${mix(colors['glass-ice'], 8)} 100%)`;
    const sweep = `radial-gradient(120% 80% at 8% 0%, ${specular} 0%, transparent 40%)`;
    const mintReturn = `radial-gradient(90% 70% at 100% 120%, ${mix(colors.mint, 22)} 0%, transparent 55%)`;
    const shadow = flat ? [] : splitShadowLayers(Shadows[theme][pressed ? 'bezel-pressed' : lift]);

    return {
      position: 'absolute',
      top: inset,
      right: inset,
      bottom: inset,
      left: inset,
      borderRadius: flat ? 0 : Math.max(radius - Rim[rim], 0),
      backgroundColor: variant === 'tint' ? colors.primary : colors['glass-fill-solid'],
      experimental_backgroundImage: (flat ? [mintReturn, tint] : [sweep, mintReturn, tint]).join(', '),
      boxShadow: joinShadow(shadow.filter((layer: string): boolean => layer.startsWith('inset'))),
    };
  }, [theme, flat, rim, radius, variant, pressed, lift]);

  const glassVars = useMemo((): ViewStyle => {
    const colors = Colors[theme];
    return variant === 'tint'
      ? vars({
          '--foreground': colors['primary-foreground'],
          '--muted-foreground': colors['primary-foreground'],
        })
      : vars({ '--muted-foreground': colors['on-glass-muted'] });
  }, [theme, variant]);

  return (
    <View {...rest} style={[material, style, glassVars]}>
      <View pointerEvents="none" style={body} />
      {children}
    </View>
  );
}
