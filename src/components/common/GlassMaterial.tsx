import {
  Blur,
  BlurMask,
  Canvas,
  FillType,
  Group,
  ImageShader,
  LinearGradient,
  Paint,
  Path,
  RadialGradient,
  Rect,
  RoundedRect,
  Shader,
  Skia,
  type SkImage,
  type SkPath,
  type Vector,
  vec,
} from 'react-native-skia';
import { type ReactElement, useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { Colors, Rim, Shadows } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import { splitShadowLayers } from '@/utils/box-shadow';
import { type GlassRecipe, type GradientStop, glassRecipe, type RadialLayer } from '@/utils/glass-recipe';
import type { GlassLift, RimWidth } from './Glass';

/** What the material refracts: a captured image and where the material sits inside it, in dp. */
export interface GlassBackdropImage {
  image: SkImage;
  /** The material's top-left corner inside the captured view. */
  x: number;
  y: number;
  /** The captured view's size, so the image lines up with what is under the material. */
  width: number;
  height: number;
}

/** An inset shadow layer and the path that draws it. */
interface InsetShadowPath {
  shadow: InsetShadow;
  path: SkPath;
}

/** Everything {@link GlassMaterial} draws, computed once per size, theme and state. */
interface MaterialLayers {
  body: BodyRect;
  rim: SkiaStops & { line: [Vector, Vector] };
  tint: SkiaStops & { line: [Vector, Vector] };
  sweep: SkiaRadial;
  mintReturn: SkiaRadial;
  shadowPaths: InsetShadowPath[];
  bodyClip: ReturnType<typeof Skia.RRectXY>;
}

/** Props for {@link GlassMaterial}. */
export interface GlassMaterialProps {
  width: number;
  height: number;
  /** Outer corner radius in dp. */
  radius: number;
  rim?: RimWidth;
  /** `'strong'` dims the top-left sweep, as in `Glass`. */
  variant?: 'regular' | 'strong';
  lift?: Exclude<GlassLift, 'none'>;
  pressed?: boolean;
  /** The captured view to refract. `null` draws the Solid fill instead. */
  backdrop: GlassBackdropImage | null;
  /** Backdrop blur in dp. Low values keep the refraction readable. */
  blur?: number;
  /** How far the edge bends the backdrop, in dp. */
  refraction?: number;
}

/** Backdrop blur in dp: light enough that the refraction stays readable (owner's pick, ganapps-home#288). */
export const GLASS_BACKDROP_BLUR = 0.3;

/** Bends the backdrop inward near the rounded edge, with a slight colour split, like a thick lens. */
const REFRACT = Skia.RuntimeEffect.Make(`
uniform shader backdrop;
uniform float2 size;
uniform float radius;
uniform float strength;

float sdRoundedBox(float2 p, float2 b, float r) {
  float2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

half4 main(float2 xy) {
  float2 centred = xy - size * 0.5;
  float dist = sdRoundedBox(centred, size * 0.5, radius);
  float edge = clamp(1.0 + dist / (radius * 0.9), 0.0, 1.0);
  float bend = pow(edge, 2.2) * strength;
  float2 dir = normalize(centred + float2(0.0001));
  float2 uv = xy - dir * bend;
  float split = bend * 0.12;
  half r = backdrop.eval(uv + dir * split).r;
  half g = backdrop.eval(uv).g;
  half b = backdrop.eval(uv - dir * split).b;
  return half4(r, g, b, 1.0);
}
`);

/** One `inset` layer of a CSS `boxShadow`, in dp. */
interface InsetShadow {
  dx: number;
  dy: number;
  blur: number;
  spread: number;
  color: string;
}

const INSET_LAYER = /^inset\s+(-?[\d.]+)(?:px)?\s+(-?[\d.]+)(?:px)?\s+(-?[\d.]+)(?:px)?\s+(-?[\d.]+)(?:px)?\s+(.+)$/;

/**
 * Reads the `inset` layers out of a `Shadows` token. Outset layers are left to the caller's `boxShadow`.
 *
 * @param shadow - A CSS `boxShadow` value.
 * @returns The inset layers, in paint order.
 */
function parseInsetShadows(shadow: string): InsetShadow[] {
  return splitShadowLayers(shadow).flatMap((layer: string): InsetShadow[] => {
    const match = INSET_LAYER.exec(layer);
    if (match === null) return [];
    return [
      { dx: Number(match[1]), dy: Number(match[2]), blur: Number(match[3]), spread: Number(match[4]), color: match[5] },
    ];
  });
}

/**
 * Start and end points of a CSS `linear-gradient(<angle>deg, ...)` over a box, so Skia draws the same line.
 *
 * @param degrees - The CSS angle: 0 points up, 90 points right.
 * @param width - Box width.
 * @param height - Box height.
 * @param origin - The box's top-left corner.
 * @returns The gradient's start and end points.
 */
function cssGradientLine(degrees: number, width: number, height: number, origin: Vector): [Vector, Vector] {
  const radians = (degrees * Math.PI) / 180;
  const dx = Math.sin(radians);
  const dy = -Math.cos(radians);
  const half = (Math.abs(width * dx) + Math.abs(height * dy)) / 2;
  const cx = origin.x + width / 2;
  const cy = origin.y + height / 2;
  return [vec(cx - dx * half, cy - dy * half), vec(cx + dx * half, cy + dy * half)];
}

/** The body inside the rim ring, in dp. */
interface BodyRect {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
}

/** A gradient's colors and positions, as Skia's gradient components take them. */
interface SkiaStops {
  colors: string[];
  positions: number[];
}

/**
 * Splits recipe stops into Skia's parallel color and position arrays.
 *
 * @param stops - The recipe stops.
 * @returns The colors and positions.
 */
function skiaStops(stops: readonly GradientStop[]): SkiaStops {
  return {
    colors: stops.map((stop: GradientStop): string => stop.color),
    positions: stops.map((stop: GradientStop): number => stop.at),
  };
}

/** A CSS ellipse gradient placed on the body: a circle squashed on y around its centre. */
interface SkiaRadial extends SkiaStops {
  c: Vector;
  r: number;
  scaleY: number;
}

/**
 * Places a recipe {@link RadialLayer} on the body the way CSS sizes its ellipse: width by the body's width,
 * height by its height.
 *
 * @param layer - The recipe layer.
 * @param body - The body it fills.
 * @returns Centre, radius, y squash and stops for `RadialGradient`.
 */
function skiaRadial(layer: RadialLayer, body: BodyRect): SkiaRadial {
  const r: number = body.w * layer.width;
  return {
    c: vec(body.x + body.w * layer.x, body.y + body.h * layer.y),
    r,
    scaleY: (body.h * layer.height) / r,
    ...skiaStops(layer.stops),
  };
}

/**
 * The area outside a CSS inset shadow's hole: the body offset by the shadow and shrunk by its spread.
 *
 * @param body - The body the shadow falls inside.
 * @param shadow - The inset layer.
 * @returns An even-odd path that paints everywhere except the hole.
 */
function insetShadowPath(body: BodyRect, shadow: InsetShadow): SkPath {
  const { x, y, w, h, r } = body;
  const builder = Skia.PathBuilder.Make();
  const pad = shadow.blur * 2 + Math.abs(shadow.dx) + Math.abs(shadow.dy) + 8;
  builder.addRect(Skia.XYWHRect(x - pad, y - pad, w + pad * 2, h + pad * 2));
  const holeW = Math.max(w - shadow.spread * 2, 0);
  const holeH = Math.max(h - shadow.spread * 2, 0);
  const holeR = Math.max(r - shadow.spread, 0);
  builder.addRRect(
    Skia.RRectXY(
      Skia.XYWHRect(x + shadow.spread + shadow.dx, y + shadow.spread + shadow.dy, holeW, holeH),
      holeR,
      holeR,
    ),
  );
  builder.setFillType(FillType.EvenOdd);
  return builder.build();
}

/**
 * Draws the Ganapps Glass material in Skia: the same rim ring, tint, sweep, mint return and inset bevel as
 * `Glass`, with a captured backdrop refracted under `glass-fill` (or `glass-fill-strong`) in place of the opaque fill.
 *
 * Fills its parent; the parent owns layout, the outset (drop) shadow and the content on top.
 *
 * @example
 * <View style={{ width, height, boxShadow: outsetShadow }}>
 *   <GlassMaterial width={width} height={height} radius={height / 2} backdrop={backdrop} />
 *   <Text>Label</Text>
 * </View>
 *
 * @param props - Size, radius, recipe, press state and the backdrop to refract.
 * @returns A Skia canvas drawing the material.
 */
export function GlassMaterial({
  width,
  height,
  radius,
  rim = 'md',
  variant = 'regular',
  lift = 'glass',
  pressed = false,
  backdrop,
  blur = GLASS_BACKDROP_BLUR,
  refraction = 14,
}: GlassMaterialProps): ReactElement {
  const theme = useResolvedTheme();
  const corner: number = Math.min(radius, width / 2, height / 2);

  const layers = useMemo((): MaterialLayers => {
    const inset: number = Rim[rim];
    const body: BodyRect = {
      x: inset,
      y: inset,
      w: width - inset * 2,
      h: height - inset * 2,
      r: Math.max(corner - inset, 0),
    };
    const recipe: GlassRecipe = glassRecipe(theme, variant === 'regular');
    const shadows: InsetShadow[] = parseInsetShadows(Shadows[theme][pressed ? 'bezel-pressed' : lift]);
    return {
      body,
      rim: { line: cssGradientLine(recipe.rim.angle, width, height, vec(0, 0)), ...skiaStops(recipe.rim.stops) },
      tint: {
        line: cssGradientLine(recipe.tint.angle, body.w, body.h, vec(body.x, body.y)),
        ...skiaStops(recipe.tint.stops),
      },
      sweep: skiaRadial(recipe.sweep, body),
      mintReturn: skiaRadial(recipe.mintReturn, body),
      shadowPaths: shadows.map(
        (shadow: InsetShadow): InsetShadowPath => ({ shadow, path: insetShadowPath(body, shadow) }),
      ),
      bodyClip: Skia.RRectXY(Skia.XYWHRect(body.x, body.y, body.w, body.h), body.r, body.r),
    };
  }, [theme, rim, width, height, corner, pressed, lift, variant]);

  const colors = Colors[theme];
  const { body, rim: rimRing, tint, sweep, mintReturn, shadowPaths, bodyClip } = layers;

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <RoundedRect x={0} y={0} width={width} height={height} r={corner}>
        <LinearGradient
          start={rimRing.line[0]}
          end={rimRing.line[1]}
          colors={rimRing.colors}
          positions={rimRing.positions}
        />
      </RoundedRect>
      <Group clip={bodyClip}>
        {backdrop !== null && REFRACT !== null ? (
          <Group
            layer={
              <Paint>
                <Blur blur={blur} mode="clamp" />
              </Paint>
            }
          >
            <Rect x={body.x} y={body.y} width={body.w} height={body.h}>
              <Shader source={REFRACT} uniforms={{ size: vec(width, height), radius: corner, strength: refraction }}>
                <ImageShader
                  image={backdrop.image}
                  fit="fill"
                  rect={{ x: -backdrop.x, y: -backdrop.y, width: backdrop.width, height: backdrop.height }}
                />
              </Shader>
            </Rect>
          </Group>
        ) : null}
        <Rect
          x={body.x}
          y={body.y}
          width={body.w}
          height={body.h}
          color={
            backdrop === null
              ? colors['glass-fill-solid']
              : colors[variant === 'strong' ? 'glass-fill-strong' : 'glass-fill']
          }
        />
        <Rect x={body.x} y={body.y} width={body.w} height={body.h}>
          <LinearGradient start={tint.line[0]} end={tint.line[1]} colors={tint.colors} positions={tint.positions} />
        </Rect>
        <Rect x={body.x} y={body.y} width={body.w} height={body.h}>
          <RadialGradient
            c={mintReturn.c}
            r={mintReturn.r}
            colors={mintReturn.colors}
            positions={mintReturn.positions}
            transform={[{ scaleY: mintReturn.scaleY }]}
            origin={mintReturn.c}
          />
        </Rect>
        <Rect x={body.x} y={body.y} width={body.w} height={body.h}>
          <RadialGradient
            c={sweep.c}
            r={sweep.r}
            colors={sweep.colors}
            positions={sweep.positions}
            transform={[{ scaleY: sweep.scaleY }]}
            origin={sweep.c}
          />
        </Rect>
        {shadowPaths.map(
          ({ shadow, path }: InsetShadowPath, index: number): ReactElement => (
            <Path key={index} path={path} color={shadow.color}>
              {shadow.blur > 0 ? <BlurMask blur={shadow.blur / 2} style="normal" /> : null}
            </Path>
          ),
        )}
      </Group>
    </Canvas>
  );
}
