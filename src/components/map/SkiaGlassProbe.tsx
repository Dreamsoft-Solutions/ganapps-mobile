import {
  Blur,
  Canvas,
  Fill,
  Group,
  ImageShader,
  LinearGradient,
  makeImageFromView,
  Paint,
  RoundedRect,
  Shader,
  Skia,
  type SkImage,
  vec,
} from '@shopify/react-native-skia';
import {
  type MutableRefObject,
  type ReactElement,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/common/Text';

/** Turns the DS-285 proof on. shortcut: dev-only spike, replaced by `GlassBackdrop` in task 2 of ganapps-home#288. */
export const SKIA_GLASS_PROBE: boolean = __DEV__;

const PROBE_WIDTH = 240;
const PROBE_HEIGHT = 64;
const PROBE_RADIUS = PROBE_HEIGHT / 2;
const BLUR = 6;
/** How many captures are averaged into one logged timing line. */
const LOG_EVERY = 30;

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

/** Props for {@link SkiaGlassProbe}. */
interface SkiaGlassProbeProps {
  /** The view wrapping the map, rendered with `collapsable={false}`. Only this view is captured. */
  targetRef: RefObject<View | null>;
  /** Receives the capture function, so the map can ask for a frame on every camera change without re-rendering. */
  captureRef: MutableRefObject<(() => void) | null>;
  /** Where the pill sits inside the target, in dp. */
  x: number;
  y: number;
  /** The target's size in dp, so the snapshot lines up with the map under the pill. */
  targetWidth: number;
  targetHeight: number;
}

/**
 * DS-285 proof: a glass pill that re-snapshots the map under it and draws it refracted and blurred.
 *
 * One capture runs at a time; a camera change during a capture is picked up when it finishes. Each
 * capture's duration is logged (`[skia-glass]`, averaged over {@link LOG_EVERY}) for the go/no-go.
 *
 * @param props - The capture target, the capture hand-off ref and the pill's position.
 * @returns The glass pill, absolutely positioned over the map.
 */
export function SkiaGlassProbe({
  targetRef,
  captureRef,
  x,
  y,
  targetWidth,
  targetHeight,
}: SkiaGlassProbeProps): ReactElement {
  const [snapshot, setSnapshot] = useState<SkImage | null>(null);
  const inFlight = useRef<boolean>(false);
  const pending = useRef<boolean>(false);
  const timings = useRef<number[]>([]);

  const capture = useCallback((): void => {
    if (inFlight.current) {
      pending.current = true;
      return;
    }
    inFlight.current = true;
    const started: number = performance.now();
    makeImageFromView(targetRef as RefObject<View>)
      .then((image: SkImage | null): void => {
        timings.current.push(performance.now() - started);
        if (timings.current.length >= LOG_EVERY) {
          const sorted: number[] = [...timings.current].sort((a: number, b: number): number => a - b);
          const mean: number = sorted.reduce((sum: number, ms: number): number => sum + ms, 0) / sorted.length;
          console.log(
            `[skia-glass] captures=${sorted.length} mean=${mean.toFixed(1)}ms p50=${sorted[Math.floor(sorted.length / 2)].toFixed(1)}ms max=${sorted[sorted.length - 1].toFixed(1)}ms size=${image?.width()}x${image?.height()}`,
          );
          timings.current = [];
        }
        setSnapshot((previous: SkImage | null): SkImage | null => {
          previous?.dispose();
          return image;
        });
      })
      .catch((error: unknown): void => {
        console.warn('[skia-glass] capture failed', error);
      })
      .finally((): void => {
        inFlight.current = false;
        if (pending.current) {
          pending.current = false;
          captureRef.current?.();
        }
      });
  }, [targetRef, captureRef]);

  useEffect((): (() => void) => {
    captureRef.current = capture;
    capture();
    return (): void => {
      captureRef.current = null;
    };
  }, [capture, captureRef]);

  const rect = { x: 0, y: 0, width: PROBE_WIDTH, height: PROBE_HEIGHT };

  return (
    <View pointerEvents="none" style={[styles.probe, { left: x, top: y }]}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Group clip={Skia.RRectXY(Skia.XYWHRect(0, 0, PROBE_WIDTH, PROBE_HEIGHT), PROBE_RADIUS, PROBE_RADIUS)}>
          {snapshot !== null && REFRACT !== null ? (
            <Group
              layer={
                <Paint>
                  <Blur blur={BLUR} mode="clamp" />
                </Paint>
              }
            >
              <Fill>
                <Shader
                  source={REFRACT}
                  uniforms={{
                    size: vec(PROBE_WIDTH, PROBE_HEIGHT),
                    radius: PROBE_RADIUS,
                    strength: 14,
                  }}
                >
                  <ImageShader
                    image={snapshot}
                    fit="fill"
                    rect={{
                      x: -x,
                      y: -y,
                      width: targetWidth,
                      height: targetHeight,
                    }}
                  />
                </Shader>
              </Fill>
            </Group>
          ) : null}
          <RoundedRect {...rect} r={PROBE_RADIUS} color="rgba(255,255,255,0.10)" />
          <RoundedRect
            x={0.75}
            y={0.75}
            width={PROBE_WIDTH - 1.5}
            height={PROBE_HEIGHT - 1.5}
            r={PROBE_RADIUS - 0.75}
            style="stroke"
            strokeWidth={1.5}
          >
            <LinearGradient
              start={vec(0, 0)}
              end={vec(PROBE_WIDTH, PROBE_HEIGHT)}
              colors={['rgba(255,255,255,0.75)', 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.35)']}
            />
          </RoundedRect>
        </Group>
      </Canvas>
      <Text className="font-allo-semibold text-body-md">Skia glass probe</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  probe: {
    position: 'absolute',
    width: PROBE_WIDTH,
    height: PROBE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
