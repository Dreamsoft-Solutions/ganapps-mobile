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
import { mix } from '@/utils/color-mix';
import type { GlassLift, RimWidth } from './Glass';
import { splitShadowLayers } from './Glass';

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

/** Share of the Solid fill laid over the refracted backdrop, so text stays legible on a busy map. */
const BACKDROP_FILL_OPACITY = 35;

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

/**
 * The area outside a CSS inset shadow's hole: the body offset by the shadow and shrunk by its spread.
 *
 * @param x - Body left. @param y - Body top. @param w - Body width. @param h - Body height.
 * @param r - Body radius. @param shadow - The inset layer.
 * @returns An even-odd path that paints everywhere except the hole.
 */
function insetShadowPath(x: number, y: number, w: number, h: number, r: number, shadow: InsetShadow): SkPath {
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
 * `Glass`, with a captured backdrop refracted under a thin Solid fill in place of the opaque one.
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
  blur = 0.3,
  refraction = 14,
}: GlassMaterialProps): ReactElement {
  const theme = useResolvedTheme();

  const layers = useMemo(() => {
    const colors = Colors[theme];
    const inset = Rim[rim];
    const body = { x: inset, y: inset, w: width - inset * 2, h: height - inset * 2, r: Math.max(radius - inset, 0) };
    const shadows = parseInsetShadows(Shadows[theme][pressed ? 'bezel-pressed' : lift]);
    return {
      colors,
      body,
      rimLine: cssGradientLine(145, width, height, vec(0, 0)),
      tintLine: cssGradientLine(140, body.w, body.h, vec(body.x, body.y)),
      specular: variant === 'regular' ? colors['glass-highlight'] : mix(colors['glass-highlight'], 45),
      shadowPaths: shadows.map((shadow: InsetShadow) => ({
        shadow,
        path: insetShadowPath(body.x, body.y, body.w, body.h, body.r, shadow),
      })),
      bodyClip: Skia.RRectXY(Skia.XYWHRect(body.x, body.y, body.w, body.h), body.r, body.r),
    };
  }, [theme, rim, width, height, radius, pressed, lift, variant]);

  const { colors, body, rimLine, tintLine, specular, shadowPaths, bodyClip } = layers;
  const sweepCentre = vec(body.x + body.w * 0.08, body.y);
  const sweepRadius = body.w * 1.2;
  const returnCentre = vec(body.x + body.w, body.y + body.h * 1.2);
  const returnRadius = body.w * 0.9;

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <RoundedRect x={0} y={0} width={width} height={height} r={radius}>
        <LinearGradient
          start={rimLine[0]}
          end={rimLine[1]}
          colors={[mix(colors['glass-ice'], 90), colors['glass-rim'], mix(colors.mint, 16), mix(colors.mint, 72)]}
          positions={[0, 0.26, 0.62, 1]}
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
              <Shader source={REFRACT} uniforms={{ size: vec(width, height), radius, strength: refraction }}>
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
            backdrop === null ? colors['glass-fill-solid'] : mix(colors['glass-fill-solid'], BACKDROP_FILL_OPACITY)
          }
        />
        <Rect x={body.x} y={body.y} width={body.w} height={body.h}>
          <LinearGradient
            start={tintLine[0]}
            end={tintLine[1]}
            colors={[mix(colors['glass-ice'], 14), mix(colors.mint, 6), mix(colors['glass-ice'], 8)]}
            positions={[0, 0.42, 1]}
          />
        </Rect>
        <Rect x={body.x} y={body.y} width={body.w} height={body.h}>
          <RadialGradient
            c={returnCentre}
            r={returnRadius}
            colors={[mix(colors.mint, 22), 'transparent']}
            positions={[0, 0.55]}
            transform={[{ scaleY: (body.h * 0.7) / returnRadius }]}
            origin={returnCentre}
          />
        </Rect>
        <Rect x={body.x} y={body.y} width={body.w} height={body.h}>
          <RadialGradient
            c={sweepCentre}
            r={sweepRadius}
            colors={[specular, 'transparent']}
            positions={[0, 0.4]}
            transform={[{ scaleY: (body.h * 0.8) / sweepRadius }]}
            origin={sweepCentre}
          />
        </Rect>
        {shadowPaths.map(
          ({ shadow, path }: { shadow: InsetShadow; path: SkPath }, index: number): ReactElement => (
            <Path key={index} path={path} color={shadow.color}>
              {shadow.blur > 0 ? <BlurMask blur={shadow.blur / 2} style="normal" /> : null}
            </Path>
          ),
        )}
      </Group>
    </Canvas>
  );
}
