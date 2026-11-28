import { vars } from 'nativewind';
import { type ReactElement, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';

import { BorderRadius, Colors, Rim, Shadows } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import { mix } from '@/utils/color-mix';
import { measureInWindow, useGlassBackdrop, type WindowRect } from './GlassBackdrop';
import { GlassMaterial } from './GlassMaterial';

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
 * Inside a `GlassBackdrop` with a capture, a `regular` or `strong` pane that is not the flat bar draws the Skia
 * tier instead: `GlassMaterial` refracts its slice of the captured backdrop under the same rim and bevel. It
 * re-measures its place on every capture and on `remeasure()`, from an absolute layer inside any border, so a
 * bordered pane's shape is not clipped. Everywhere else it draws the Solid tier.
 * Liquid Glass on iOS 26 (ganapps-home#280) slots in here too.
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
  const backdrop = useGlassBackdrop();
  const layerRef = useRef<View>(null);
  const [placement, setPlacement] = useState<WindowRect | null>(null);
  const [layoutVersion, setLayoutVersion] = useState<number>(0);
  const frame = backdrop?.frame ?? null;
  const eligible: boolean = !flat && (variant === 'regular' || variant === 'strong');

  useLayoutEffect((): void => {
    if (!eligible || frame === null) return;
    const rect: WindowRect | null = measureInWindow(layerRef.current);
    setPlacement(rect === null ? null : { ...rect, x: rect.x - frame.rect.x, y: rect.y - frame.rect.y });
  }, [eligible, frame, backdrop?.version, layoutVersion]);

  const skia: boolean = frame !== null && placement !== null && !flat;

  const material = useMemo((): ViewStyle => {
    const colors = Colors[theme];
    const rimGradient = `linear-gradient(145deg, ${mix(colors['glass-ice'], 90)} 0%, ${colors['glass-rim']} 26%, ${mix(colors.mint, 16)} 62%, ${mix(colors.mint, 72)} 100%)`;
    const shadow = flat ? [] : splitShadowLayers(Shadows[theme][pressed ? 'bezel-pressed' : lift]);

    return {
      borderRadius: flat ? 0 : radius,
      experimental_backgroundImage: flat || skia ? undefined : rimGradient,
      experimental_backgroundRepeat: 'no-repeat',
      boxShadow: joinShadow(shadow.filter((layer: string): boolean => !layer.startsWith('inset'))),
    };
  }, [theme, flat, radius, pressed, lift, skia]);

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
      {eligible && frame !== null ? (
        <View
          ref={layerRef}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          onLayout={(): void => {
            setLayoutVersion((current: number): number => current + 1);
          }}
        >
          {skia && placement !== null && lift !== 'none' ? (
            <GlassMaterial
              width={placement.width}
              height={placement.height}
              radius={radius}
              rim={rim}
              variant={variant === 'strong' ? 'strong' : 'regular'}
              lift={lift}
              pressed={pressed}
              backdrop={{
                image: frame.image,
                x: placement.x,
                y: placement.y,
                width: frame.rect.width,
                height: frame.rect.height,
              }}
            />
          ) : null}
        </View>
      ) : null}
      {skia ? null : <View pointerEvents="none" style={body} />}
      {children}
    </View>
  );
}
