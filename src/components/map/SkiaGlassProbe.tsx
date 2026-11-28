import { Skia, type SkImage } from 'react-native-skia';
import { importDevice } from 'react-native-webgpu';
import {
  type MutableRefObject,
  type ReactElement,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { PixelRatio, StyleSheet, View } from 'react-native';
import { splitShadowLayers } from '@/components/common/Glass';
import { GlassMaterial } from '@/components/common/GlassMaterial';
import { Text } from '@/components/common/Text';
import { Shadows } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';

/** Turns the DS-285 proof on. shortcut: dev-only spike, replaced by `GlassBackdrop` in task 2 of ganapps-home#288. */
export const SKIA_GLASS_PROBE: boolean = __DEV__;

const PROBE_WIDTH = 240;
const PROBE_HEIGHT = 64;
const PROBE_RADIUS = PROBE_HEIGHT / 2;
/** 5% of the first probe's 6 dp blur, per the owner's review. */
const BLUR = 0.3;
/** How many captures are averaged into one logged timing line. */
const LOG_EVERY = 30;

/** A captured frame and the GPU texture behind it, released together. */
interface CapturedFrame {
  image: SkImage;
  texture: GPUTexture;
}

/**
 * Rasterizes a native view into a GPU texture on Skia's own device and wraps it as an image, without a copy.
 *
 * @param target - The view to capture, rendered with `collapsable={false}`.
 * @param width - The view's width in dp. @param height - The view's height in dp.
 * @returns The captured frame.
 */
async function captureView(target: RefObject<View | null>, width: number, height: number): Promise<CapturedFrame> {
  const device: GPUDevice = importDevice(Skia.getNativeDevice());
  const scale: number = PixelRatio.get();
  const texture: GPUTexture = device.createTexture({
    size: [Math.round(width * scale), Math.round(height * scale)],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  });
  await device.queue.drawElementImageToTexture({ source: target }, { texture, premultipliedAlpha: true });
  return { image: Skia.Image.MakeFromGPUTexture(texture), texture };
}

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
  const frameRef = useRef<CapturedFrame | null>(null);
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
    captureView(targetRef, targetWidth, targetHeight)
      .then((frame: CapturedFrame): void => {
        const image: SkImage = frame.image;
        timings.current.push(performance.now() - started);
        if (timings.current.length >= LOG_EVERY) {
          const sorted: number[] = [...timings.current].sort((a: number, b: number): number => a - b);
          const mean: number = sorted.reduce((sum: number, ms: number): number => sum + ms, 0) / sorted.length;
          console.log(
            `[skia-glass] captures=${sorted.length} mean=${mean.toFixed(1)}ms p50=${sorted[Math.floor(sorted.length / 2)].toFixed(1)}ms max=${sorted[sorted.length - 1].toFixed(1)}ms size=${image.width()}x${image.height()}`,
          );
          timings.current = [];
        }
        const previous: CapturedFrame | null = frameRef.current;
        frameRef.current = frame;
        setSnapshot(image);
        previous?.image.dispose();
        previous?.texture.destroy();
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
  }, [targetRef, captureRef, targetWidth, targetHeight]);

  useEffect((): (() => void) => {
    captureRef.current = capture;
    capture();
    return (): void => {
      captureRef.current = null;
    };
  }, [capture, captureRef]);

  const theme = useResolvedTheme();
  const outset: string = splitShadowLayers(Shadows[theme].glass)
    .filter((layer: string): boolean => !layer.startsWith('inset'))
    .join(', ');

  return (
    <View
      pointerEvents="none"
      style={[styles.probe, { left: x, top: y, borderRadius: PROBE_RADIUS, boxShadow: outset }]}
    >
      <GlassMaterial
        width={PROBE_WIDTH}
        height={PROBE_HEIGHT}
        radius={PROBE_RADIUS}
        blur={BLUR}
        backdrop={snapshot === null ? null : { image: snapshot, x, y, width: targetWidth, height: targetHeight }}
      />
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
