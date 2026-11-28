import { Colors } from '@/constants/theme';
import { mix } from '@/utils/color-mix';

/** A gradient stop: a color and its position along the gradient, from 0 to 1. */
export interface GradientStop {
  color: string;
  at: number;
}

/** A linear gradient as CSS states it: an angle in degrees (0 points up) and its stops. */
export interface LinearLayer {
  angle: number;
  stops: GradientStop[];
}

/**
 * A radial gradient as CSS states it (`radial-gradient(W% H% at X% Y%, ...)`): the ellipse's size and centre
 * as fractions of the box, and its stops.
 */
export interface RadialLayer {
  width: number;
  height: number;
  x: number;
  y: number;
  stops: GradientStop[];
}

/** Every gradient the Glass material draws, shared by the Solid tier (CSS) and the live tier (Skia). */
export interface GlassRecipe {
  /** The rim ring around the body. */
  rim: LinearLayer;
  /** The ice-to-mint wash over the body. */
  tint: LinearLayer;
  /** The specular sweep falling on the top-left. */
  sweep: RadialLayer;
  /** The mint light rising from the bottom-right. */
  mintReturn: RadialLayer;
}

/**
 * Builds the Ganapps Glass recipe for a theme. `Glass` turns it into CSS gradients and `GlassMaterial` into
 * Skia shaders, so a change here reaches both tiers.
 *
 * @param theme - The theme in effect.
 * @param fullSweep - `true` for `regular` glass; denser panes dim the sweep to 45%.
 * @returns The rim, tint, sweep and mint return.
 */
export function glassRecipe(theme: 'light' | 'dark', fullSweep: boolean): GlassRecipe {
  const colors = Colors[theme];
  const specular: string = fullSweep ? colors['glass-highlight'] : mix(colors['glass-highlight'], 45);
  return {
    rim: {
      angle: 145,
      stops: [
        { color: mix(colors['glass-ice'], 90), at: 0 },
        { color: colors['glass-rim'], at: 0.26 },
        { color: mix(colors.mint, 16), at: 0.62 },
        { color: mix(colors.mint, 72), at: 1 },
      ],
    },
    tint: {
      angle: 140,
      stops: [
        { color: mix(colors['glass-ice'], 14), at: 0 },
        { color: mix(colors.mint, 6), at: 0.42 },
        { color: mix(colors['glass-ice'], 8), at: 1 },
      ],
    },
    sweep: {
      width: 1.2,
      height: 0.8,
      x: 0.08,
      y: 0,
      stops: [
        { color: specular, at: 0 },
        { color: 'transparent', at: 0.4 },
      ],
    },
    mintReturn: {
      width: 0.9,
      height: 0.7,
      x: 1,
      y: 1.2,
      stops: [
        { color: mix(colors.mint, 22), at: 0 },
        { color: 'transparent', at: 0.55 },
      ],
    },
  };
}

/**
 * A fraction as a whole CSS percentage; rounding keeps float noise like 26.000000000000004 out of the CSS.
 */
function percent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

/**
 * Writes a {@link LinearLayer} as a CSS `linear-gradient()`.
 *
 * @param layer - The gradient.
 * @returns The CSS value.
 */
export function linearCss(layer: LinearLayer): string {
  const stops: string = layer.stops.map((stop: GradientStop): string => `${stop.color} ${percent(stop.at)}`).join(', ');
  return `linear-gradient(${layer.angle}deg, ${stops})`;
}

/**
 * Writes a {@link RadialLayer} as a CSS `radial-gradient()`.
 *
 * @param layer - The gradient.
 * @returns The CSS value.
 */
export function radialCss(layer: RadialLayer): string {
  const stops: string = layer.stops.map((stop: GradientStop): string => `${stop.color} ${percent(stop.at)}`).join(', ');
  return `radial-gradient(${percent(layer.width)} ${percent(layer.height)} at ${percent(layer.x)} ${percent(layer.y)}, ${stops})`;
}
