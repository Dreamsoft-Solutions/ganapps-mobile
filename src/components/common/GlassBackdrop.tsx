import {
  createContext,
  type ReactElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
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

/** What the screen holding the {@link GlassBackdropTarget} uses to drive a {@link GlassBackdrop} above it. */
export interface GlassBackdropHandle {
  /** Whether live glass runs. Screens read it here so they agree with the backdrop (e.g. the map's TextureView). */
  enabled: boolean;
  /** Captures the target now; calls during a capture coalesce into one more. */
  capture: () => void;
  remeasure: () => void;
}

interface GlassBackdropControls extends GlassBackdropHandle {
  targetRef: React.RefObject<View | null>;
  /** Drops the frame, so panes go Solid while no target is mounted (the map screen's error or loading view). */
  clear: () => void;
}

/** Changes on every capture: only the panes read it. */
const GlassBackdropContext = createContext<GlassBackdropValue | null>(null);

/** Never changes, so the screen that captures does not re-render on each frame. */
const GlassBackdropControlsContext = createContext<GlassBackdropControls | null>(null);

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

/** One accessibility setting that forces the Solid tier. */
type SolidGlassSetting = (typeof SOLID_GLASS_SETTINGS)[number];

/** Last known state of each {@link SOLID_GLASS_SETTINGS} entry, read once at app start so screens mount on the right tier. */
const solidGlassSettingsOn: boolean[] = SOLID_GLASS_SETTINGS.map((): boolean => false);

SOLID_GLASS_SETTINGS.forEach((setting: SolidGlassSetting, index: number): void => {
  setting
    .query()
    .then((enabled: boolean): void => {
      solidGlassSettingsOn[index] = enabled;
    })
    .catch((): void => undefined);
});

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
  const [settingsOn, setSettingsOn] = useState<readonly boolean[]>((): readonly boolean[] => [...solidGlassSettingsOn]);

  useEffect((): (() => void) => {
    const subscriptions: { remove: () => void }[] = SOLID_GLASS_SETTINGS.map(
      (setting: SolidGlassSetting, index: number): { remove: () => void } =>
        AccessibilityInfo.addEventListener(setting.event, (enabled: boolean): void => {
          solidGlassSettingsOn[index] = enabled;
          setSettingsOn([...solidGlassSettingsOn]);
        }),
    );
    return (): void => {
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
 * Releases a capture: the image goes before its texture, as the WebGPU snapshot docs require. Only call it
 * after React has committed a render that no longer draws the image.
 */
function releaseFrame(frame: CapturedFrame): void {
  frame.image.dispose();
  frame.texture.destroy();
}

/** Props for {@link GlassBackdrop}. */
export interface GlassBackdropProps {
  children: ReactNode;
  /** `false` keeps every pane on the Solid tier and stops capturing. Pass {@link useLiveGlassEnabled}. */
  enabled: boolean;
}

/**
 * Supplies a live capture of one view, the {@link GlassBackdropTarget}, to every `Glass` inside it, so the
 * panes draw that view refracted under their bevel. One capture feeds every pane.
 *
 * It sits in the tabs layout so the tab island shares the home map's capture. The screen that holds the target
 * decides when to capture, through {@link useGlassBackdropControls}: the home map captures on each camera change
 * and when it settles. Nothing is captured while `enabled` is `false`. Fence screens that are not over the
 * target with {@link NoGlassBackdrop}, or their panes refract a map they do not sit on.
 *
 * @example
 * // Tabs layout
 * <GlassBackdrop enabled={useLiveGlassEnabled()}>
 *   <Tabs screenLayout={({ route, children }) => (
 *     <NoGlassBackdrop when={route.name !== '(home)'}>{children}</NoGlassBackdrop>
 *   )} />
 * </GlassBackdrop>
 *
 * // Home screen
 * const backdrop = useGlassBackdropControls();
 * <GlassBackdropTarget style={{ flex: 1 }}>
 *   <MapView onCameraChanged={() => backdrop?.capture()} />
 * </GlassBackdropTarget>
 * <Glass className="absolute top-12 px-lg">...</Glass>
 *
 * @param props - The content and whether live glass may run.
 * @returns The provider around its children.
 */
export function GlassBackdrop({ children, enabled }: GlassBackdropProps): ReactElement {
  const targetRef = useRef<View | null>(null);
  const liveFrames = useRef<CapturedFrame[]>([]);
  const inFlight = useRef<boolean>(false);
  const pending = useRef<boolean>(false);
  const mounted = useRef<boolean>(true);
  const enabledRef = useRef<boolean>(enabled);
  const captureRef = useRef<() => void>((): void => undefined);
  const [frame, setFrame] = useState<GlassBackdropFrame | null>(null);
  const [version, setVersion] = useState<number>(0);
  const [wasEnabled, setWasEnabled] = useState<boolean>(enabled);

  if (wasEnabled !== enabled) {
    setWasEnabled(enabled);
    if (!enabled) setFrame(null);
  }

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
        if (!mounted.current || !enabledRef.current || targetRef.current === null) {
          releaseFrame(next);
          return;
        }
        liveFrames.current.push(next);
        setFrame({ image: next.image, rect: next.rect });
      })
      .catch((error: unknown): void => {
        console.warn('[glass] backdrop capture failed', error);
      })
      .finally((): void => {
        inFlight.current = false;
        if (pending.current && mounted.current) {
          pending.current = false;
          captureRef.current();
        }
      });
  }, []);

  const remeasure = useCallback((): void => {
    setVersion((current: number): number => current + 1);
  }, []);

  const clear = useCallback((): void => {
    setFrame(null);
  }, []);

  useLayoutEffect((): void => {
    captureRef.current = capture;
  }, [capture]);

  useEffect((): void => {
    liveFrames.current = liveFrames.current.filter((live: CapturedFrame): boolean => {
      if (live.image === frame?.image) return true;
      releaseFrame(live);
      return false;
    });
  }, [frame]);

  useEffect((): (() => void) => {
    mounted.current = true;
    return (): void => {
      mounted.current = false;
      for (const live of liveFrames.current) releaseFrame(live);
      liveFrames.current = [];
    };
  }, []);

  const value = useMemo((): GlassBackdropValue => ({ frame, version, remeasure }), [frame, version, remeasure]);
  const controls = useMemo(
    (): GlassBackdropControls => ({ enabled, capture, remeasure, clear, targetRef }),
    [enabled, capture, remeasure, clear],
  );

  return (
    <GlassBackdropControlsContext.Provider value={controls}>
      <GlassBackdropContext.Provider value={value}>{children}</GlassBackdropContext.Provider>
    </GlassBackdropControlsContext.Provider>
  );
}

/**
 * The view a {@link GlassBackdrop} captures. Wrap only the backdrop (the map), never a view that holds glass.
 *
 * @param props - View props; layout classes land on the wrapper.
 * @returns The wrapper the backdrop captures.
 */
export function GlassBackdropTarget({ children, ...props }: ViewProps): ReactElement {
  const controls = useContext(GlassBackdropControlsContext);

  useEffect((): (() => void) => {
    return (): void => {
      controls?.clear();
    };
  }, [controls]);

  return (
    <View {...props} ref={controls?.targetRef} collapsable={false}>
      {children}
    </View>
  );
}

/**
 * Hides the backdrop from everything inside it, so glass there draws the Solid tier. Use it for content
 * that sits on another surface, like a sheet: refracting the map through it would ignore what is between.
 * `Glass` wraps its own children in one. `when` switches the fence without remounting the content, so a pane
 * that is over the backdrop only some of the time (the tab island) keeps its state.
 *
 * @param props - The content to cut off from the backdrop, and whether to cut it off (default `true`).
 * @returns The content, outside any backdrop while `when` holds.
 */
export function NoGlassBackdrop({ children, when = true }: { children: ReactNode; when?: boolean }): ReactElement {
  const parent = useContext(GlassBackdropContext);
  return <GlassBackdropContext.Provider value={when ? null : parent}>{children}</GlassBackdropContext.Provider>;
}

/**
 * Reads the nearest {@link GlassBackdrop}, or `null` outside one.
 *
 * @returns The latest frame, the re-measure counter and trigger.
 */
export function useGlassBackdrop(): GlassBackdropValue | null {
  return useContext(GlassBackdropContext);
}

/**
 * Reads the controls of the nearest {@link GlassBackdrop}, or `null` outside one. The value changes only with
 * `enabled`, so calling it does not re-render on each capture.
 *
 * @returns Whether live glass runs, `capture()` and `remeasure()`.
 */
export function useGlassBackdropControls(): GlassBackdropHandle | null {
  return useContext(GlassBackdropControlsContext);
}
