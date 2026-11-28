import { vars } from 'nativewind';
import { type ReactElement, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';
import type { SkImage } from 'react-native-skia';

import { BorderRadius, Colors, Rim, Shadows } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import { splitShadowLayers } from '@/utils/box-shadow';
import { type GlassRecipe, glassRecipe, linearCss, radialCss } from '@/utils/glass-recipe';
import { measureInWindow, NoGlassBackdrop, useGlassBackdrop, type WindowRect } from './GlassBackdrop';
import { type GlassBackdropImage, GlassMaterial } from './GlassMaterial';

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
  /**
   * Refracts this image, cover-fitted to the pane and blurred, instead of the screen's backdrop: a card over its
   * own photo. `null` (loading, no photo, live glass off) draws the Solid tier.
   */
  image?: SkImage | null;
}

/** Blur over a pane's own photo, in dp: enough to read text over any photo, little enough to know the photo. */
const IMAGE_BLUR = 20;

/**
 * Places an image the way `contentFit="cover"` does: scaled to fill the pane, centred, the overflow cropped.
 *
 * @param image - The photo.
 * @param width - Pane width.
 * @param height - Pane height.
 * @returns The backdrop for `GlassMaterial`.
 */
function coverFit(image: SkImage, width: number, height: number): GlassBackdropImage {
  const scale: number = Math.max(width / image.width(), height / image.height());
  const fitted = { width: image.width() * scale, height: image.height() * scale };
  return { image, x: (fitted.width - width) / 2, y: (fitted.height - height) / 2, ...fitted };
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
 * bordered pane's shape is not clipped. With an `image`, it refracts that photo, blurred, instead: no capture,
 * no measuring, so it holds still in a scrolling list. Everywhere else it draws the Solid tier.
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
  image = null,
  style,
  children,
  ...rest
}: GlassProps): ReactElement {
  const theme = useResolvedTheme();
  const flat = lift === 'none';
  const backdrop = useGlassBackdrop();
  const layerRef = useRef<View>(null);
  const [placement, setPlacement] = useState<WindowRect | null>(null);
  const [layerSize, setLayerSize] = useState<{ width: number; height: number } | null>(null);
  const frame = image === null ? (backdrop?.frame ?? null) : null;
  const eligible: boolean = !flat && (variant === 'regular' || variant === 'strong');

  useLayoutEffect((): void => {
    if (!eligible || frame === null) return;
    const rect: WindowRect | null = measureInWindow(layerRef.current);
    setPlacement(rect === null ? null : { ...rect, x: rect.x - frame.rect.x, y: rect.y - frame.rect.y });
  }, [eligible, frame, backdrop?.version, layerSize]);

  const source = useMemo((): (GlassBackdropImage & { paneWidth: number; paneHeight: number }) | null => {
    if (!eligible) return null;
    if (image !== null) {
      return layerSize === null
        ? null
        : {
            ...coverFit(image, layerSize.width, layerSize.height),
            paneWidth: layerSize.width,
            paneHeight: layerSize.height,
          };
    }
    if (frame === null || placement === null) return null;
    return {
      image: frame.image,
      x: placement.x,
      y: placement.y,
      width: frame.rect.width,
      height: frame.rect.height,
      paneWidth: placement.width,
      paneHeight: placement.height,
    };
  }, [eligible, image, layerSize, frame, placement]);

  const skia: boolean = source !== null;

  const material = useMemo((): ViewStyle => {
    const rimGradient: string = linearCss(glassRecipe(theme, variant === 'regular').rim);
    const shadow = flat ? [] : splitShadowLayers(Shadows[theme][pressed ? 'bezel-pressed' : lift]);

    return {
      borderRadius: flat ? 0 : radius,
      experimental_backgroundImage: flat || skia ? undefined : rimGradient,
      experimental_backgroundRepeat: 'no-repeat',
      boxShadow: joinShadow(shadow.filter((layer: string): boolean => !layer.startsWith('inset'))),
    };
  }, [theme, variant, flat, radius, pressed, lift, skia]);

  const body = useMemo((): ViewStyle => {
    const colors = Colors[theme];
    const inset = flat ? 0 : Rim[rim];
    const recipe: GlassRecipe = glassRecipe(theme, variant === 'regular');
    const tint: string = linearCss(recipe.tint);
    const sweep: string = radialCss(recipe.sweep);
    const mintReturn: string = radialCss(recipe.mintReturn);
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
      {eligible && (frame !== null || image !== null) ? (
        <View
          ref={layerRef}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          onLayout={(event: LayoutChangeEvent): void => {
            const { width, height } = event.nativeEvent.layout;
            setLayerSize({ width, height });
          }}
        >
          {source !== null && lift !== 'none' ? (
            <GlassMaterial
              width={source.paneWidth}
              height={source.paneHeight}
              radius={radius}
              rim={rim}
              variant={variant === 'strong' ? 'strong' : 'regular'}
              lift={lift}
              pressed={pressed}
              backdrop={source}
              blur={image === null ? undefined : IMAGE_BLUR}
            />
          ) : null}
        </View>
      ) : null}
      {skia ? null : <View pointerEvents="none" style={body} />}
      <NoGlassBackdrop>{children}</NoGlassBackdrop>
    </View>
  );
}
