import {
  createContext,
  type ReactElement,
  type ReactNode,
  type Ref,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AccessibilityInfo, PixelRatio, View, type ViewProps } from 'react-native';
import { Skia, type SkImage } from 'react-native-skia';
import { importDevice } from 'react-native-webgpu';

import { useThemeStore } from '@/store/theme.store';

/** A rectangle in window coordinates, in dp. */
export interface WindowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The latest capture of the backdrop and where the captured view sat when it was taken. */
export interface GlassBackdropFrame {
  image: SkImage;
  rect: WindowRect;
}

/** What a `Glass` inside a {@link GlassBackdrop} reads to draw the Skia tier. */
export interface GlassBackdropValue {
  /** The latest capture, or `null` before the first one and while live glass is off. */
  frame: GlassBackdropFrame | null;
  /** Bumped by {@link GlassBackdropHandle.remeasure}, so panes that moved without a new capture re-measure. */
  version: number;
  /** Asks every pane to re-measure its position, e.g. while a row of glass chips scrolls. */
  remeasure: () => void;
}

/** Imperative controls for the screen that owns a {@link GlassBackdrop}. */
export interface GlassBackdropHandle {
  /** Captures the target now; calls during a capture coalesce into one more. */
  capture: () => void;
  remeasure: () => void;
}

interface GlassBackdropInternal extends GlassBackdropValue {
  targetRef: React.RefObject<View | null>;
}

const GlassBackdropContext = createContext<GlassBackdropInternal | null>(null);

/** A capture and the GPU texture behind it, released together. */
interface CapturedFrame extends GlassBackdropFrame {
  texture: GPUTexture;
}

/** The accessibility settings that put every pane on the Solid tier, with the event that reports each change. */
const SOLID_GLASS_SETTINGS = [
  { query: AccessibilityInfo.isReduceTransparencyEnabled, event: 'reduceTransparencyChanged' },
  { query: AccessibilityInfo.isDarkerSystemColorsEnabled, event: 'darkerSystemColorsChanged' },
  { query: AccessibilityInfo.isHighTextContrastEnabled, event: 'highTextContrastChanged' },
] as const satisfies readonly {
  query: () => Promise<boolean>;
  event: 'reduceTransparencyChanged' | 'darkerSystemColorsChanged' | 'highTextContrastChanged';
}[];

/**
 * Whether live glass may run: off in Performance mode, and under Reduce Transparency or Increase Contrast
 * (iOS) or high-contrast text (Android).
 *
 * Screens use it to opt their backdrop into the capture-friendly mode it needs, such as Mapbox's
 * `surfaceView={false}`.
 *
 * @returns `true` when the Skia glass tier may draw.
 */
export function useLiveGlassEnabled(): boolean {
  const performanceMode: boolean = useThemeStore((state) => state.performanceMode);
  const [settingsOn, setSettingsOn] = useState<readonly boolean[]>(SOLID_GLASS_SETTINGS.map((): boolean => false));

  useEffect((): (() => void) => {
    let active = true;
    const update = (index: number, enabled: boolean): void => {
      if (!active) return;
      setSettingsOn((current: readonly boolean[]): readonly boolean[] =>
        current.map((value: boolean, at: number): boolean => (at === index ? enabled : value)),
      );
    };
    const subscriptions = SOLID_GLASS_SETTINGS.map((setting, index: number) => {
      setting
        .query()
        .then((enabled: boolean): void => update(index, enabled))
        .catch((): void => undefined);
      return AccessibilityInfo.addEventListener(setting.event, (enabled: boolean): void => update(index, enabled));
    });
    return (): void => {
      active = false;
      for (const subscription of subscriptions) subscription.remove();
    };
  }, []);

  return !performanceMode && !settingsOn.some(Boolean);
}

/**
 * Reads the window rectangle of a host view, or `null` before it has been laid out.
 *
 * @param view - A mounted host view.
 * @returns Its rectangle in window coordinates, transforms included.
 */
export function measureInWindow(view: View | null): WindowRect | null {
  if (view === null) return null;
  const rect: DOMRect = view.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null;
}

/**
 * Rasterizes a native view into a GPU texture on Skia's own device and wraps it as an image, without a copy.
 */
async function captureView(target: View, rect: WindowRect): Promise<CapturedFrame> {
  const device: GPUDevice = importDevice(Skia.getNativeDevice());
  const scale: number = PixelRatio.get();
  const texture: GPUTexture = device.createTexture({
    size: [Math.round(rect.width * scale), Math.round(rect.height * scale)],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  });
  await device.queue.drawElementImageToTexture({ source: target }, { texture, premultipliedAlpha: true });
  return { image: Skia.Image.MakeFromGPUTexture(texture), rect, texture };
}

/**
 * Releases a capture: the image goes before its texture, as the WebGPU snapshot docs require.
 */
function releaseFrame(frame: CapturedFrame | null): void {
  frame?.image.dispose();
  frame?.texture.destroy();
}

/** Props for {@link GlassBackdrop}. */
export interface GlassBackdropProps {
  children: ReactNode;
  /** `false` keeps every pane on the Solid tier and stops capturing. Pass {@link useLiveGlassEnabled}. */
  enabled: boolean;
  ref?: Ref<GlassBackdropHandle>;
}

/**
 * Supplies a live capture of one view, the {@link GlassBackdropTarget}, to every `Glass` inside it, so the
 * panes draw that view refracted under their bevel. One capture feeds every pane.
 *
 * The owner decides when to capture, through the `ref`: the home map captures on each camera change and
 * when it settles. Nothing is captured while `enabled` is `false`.
 *
 * @example
 * const backdropRef = useRef<GlassBackdropHandle>(null);
 * <GlassBackdrop ref={backdropRef} enabled={useLiveGlassEnabled()}>
 *   <GlassBackdropTarget style={{ flex: 1 }}>
 *     <MapView onCameraChanged={() => backdropRef.current?.capture()} />
 *   </GlassBackdropTarget>
 *   <Glass className="absolute top-12 px-lg">...</Glass>
 * </GlassBackdrop>
 *
 * @param props - The content, whether live glass may run, and the handle ref.
 * @returns The provider around its children.
 */
export function GlassBackdrop({ children, enabled, ref }: GlassBackdropProps): ReactElement {
  const targetRef = useRef<View | null>(null);
  const frameRef = useRef<CapturedFrame | null>(null);
  const inFlight = useRef<boolean>(false);
  const pending = useRef<boolean>(false);
  const enabledRef = useRef<boolean>(enabled);
  const [frame, setFrame] = useState<GlassBackdropFrame | null>(null);
  const [version, setVersion] = useState<number>(0);

  const captureRef = useRef<() => void>((): void => undefined);

  useLayoutEffect((): void => {
    enabledRef.current = enabled;
  }, [enabled]);

  const capture = useCallback((): void => {
    if (!enabledRef.current) return;
    if (inFlight.current) {
      pending.current = true;
      return;
    }
    const target: View | null = targetRef.current;
    const rect: WindowRect | null = measureInWindow(target);
    if (target === null || rect === null) return;

    inFlight.current = true;
    captureView(target, rect)
      .then((next: CapturedFrame): void => {
        if (!enabledRef.current) {
          releaseFrame(next);
          return;
        }
        const previous: CapturedFrame | null = frameRef.current;
        frameRef.current = next;
        setFrame({ image: next.image, rect: next.rect });
        releaseFrame(previous);
      })
      .catch((error: unknown): void => {
        console.warn('[glass] backdrop capture failed', error);
      })
      .finally((): void => {
        inFlight.current = false;
        if (pending.current) {
          pending.current = false;
          captureRef.current();
        }
      });
  }, []);

  const remeasure = useCallback((): void => {
    setVersion((current: number): number => current + 1);
  }, []);

  useLayoutEffect((): void => {
    captureRef.current = capture;
  }, [capture]);

  useImperativeHandle(ref, (): GlassBackdropHandle => ({ capture, remeasure }), [capture, remeasure]);

  useEffect((): void => {
    if (enabled) return;
    releaseFrame(frameRef.current);
    frameRef.current = null;
  }, [enabled]);

  useEffect(
    (): (() => void) => (): void => {
      releaseFrame(frameRef.current);
      frameRef.current = null;
    },
    [],
  );

  const value = useMemo(
    (): GlassBackdropInternal => ({ frame: enabled ? frame : null, version, remeasure, targetRef }),
    [enabled, frame, version, remeasure],
  );

  return <GlassBackdropContext.Provider value={value}>{children}</GlassBackdropContext.Provider>;
}

/**
 * The view a {@link GlassBackdrop} captures. Wrap only the backdrop (the map), never a view that holds glass.
 *
 * @param props - View props; layout classes land on the wrapper.
 * @returns The wrapper the backdrop captures.
 */
export function GlassBackdropTarget({ children, ...props }: ViewProps): ReactElement {
  const backdrop = useContext(GlassBackdropContext);
  return (
    <View {...props} ref={backdrop?.targetRef} collapsable={false}>
      {children}
    </View>
  );
}

/**
 * Hides the backdrop from everything inside it, so glass there draws the Solid tier. Use it for content
 * that sits on another surface, like a sheet: refracting the map through it would ignore what is between.
 * `Glass` wraps its own children in one.
 *
 * @param props - The content to cut off from the backdrop.
 * @returns The content, outside any backdrop.
 */
export function NoGlassBackdrop({ children }: { children: ReactNode }): ReactElement {
  return <GlassBackdropContext.Provider value={null}>{children}</GlassBackdropContext.Provider>;
}

/**
 * Reads the nearest {@link GlassBackdrop}, or `null` outside one.
 *
 * @returns The latest frame, the re-measure counter and trigger.
 */
export function useGlassBackdrop(): GlassBackdropValue | null {
  return useContext(GlassBackdropContext);
}
