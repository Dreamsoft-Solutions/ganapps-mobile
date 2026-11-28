import { memo, useMemo, type ReactElement } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  clamp,
  Extrapolation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  type CSSAnimationKeyframes,
  type CSSStyle,
  type DerivedValue,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path, Rect, type PathProps } from 'react-native-svg';
import { Music, Ticket, Users, type LucideIcon } from 'lucide-react-native';

import { Capsule } from '@/components/common/Capsule';
import { CSS_EASE_OUT } from '@/constants/onboarding';
import {
  MAP_BLOCKS,
  MAP_PARKS,
  MAP_RIVER,
  MAP_SCENES,
  MAP_STREETS,
  MAP_STROKE,
  type MapDot,
  type MapPoint,
  type MapRoute,
  type MapScene,
  type MapShape,
  type MapStreetWeight,
} from '@/constants/onboarding-map';
import { Colors, type ThemeColor } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';

/** Camera speed against the pager: the canvas moves half as far as the finger. */
const PARALLAX = 0.5;
/** Scene progress at which the route line is fully drawn and the puck has arrived. */
const ROUTE_DONE_AT = 0.85;
/** Space around a route inside its own Svg, so the glow is never clipped, dp. */
const ROUTE_PAD = 8;
/** Diameter of the event pin, dp. */
const PIN_SIZE = 36;
/** Size of the icon inside the pin, dp. */
const PIN_ICON_SIZE = 16;
/** Scene progress over which the pin appears. */
const PIN_FADE: readonly [number, number] = [0.8, 1];
/** Diameter of the puck disc, dp. */
const PUCK_DISC = 14;
/** Width of the ring around the puck disc, dp. */
const PUCK_RING = 2;
/** Outer diameter of a puck, ring included, dp. */
const PUCK_SIZE: number = PUCK_DISC + 2 * PUCK_RING;
/** Diameter of an ambient event dot, dp. */
const DOT_SIZE = 8;
/** Scene progress over which an ambient dot fades in. */
const DOT_FADE = 0.15;
/** Length of one pulse of the pin ring, ms. */
const PULSE_DURATION = 2400;

/** One theme's colour tokens. */
type Palette = Record<ThemeColor, string>;

/** The pin ring grows and fades out, once per pulse. */
const PULSE_KEYFRAMES: CSSAnimationKeyframes<ViewStyle> = {
  from: { opacity: 0.5, transform: [{ scale: 1 }] },
  to: { opacity: 0, transform: [{ scale: 2.2 }] },
};

/** The pulse on the settled slide's pin ring. */
const PULSE: CSSStyle<ViewStyle> = {
  animationName: PULSE_KEYFRAMES,
  animationDuration: PULSE_DURATION,
  animationIterationCount: 'infinite',
  animationTimingFunction: CSS_EASE_OUT,
};

/** A still pin ring, hidden by its base opacity. */
const NO_PULSE: CSSStyle<ViewStyle> = { animationName: 'none' };

/** Icon shown in each scene's pin. */
const PIN_ICONS = { find: Music, plan: Users, keep: Ticket } satisfies Record<MapScene['key'], LucideIcon>;

/** Svg path whose stroke props Reanimated can drive on the UI thread. */
const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Rounds to one decimal place, which is plenty for path data in dp. */
function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Converts unit-coordinate shapes to Svg path data for a canvas `width` by `height` dp. */
function toPathData(shapes: readonly MapShape[], width: number, height: number): string {
  const at = (point: MapPoint): string => `${round(point.x * width)} ${round(point.y * height)}`;
  return shapes
    .map((shape: MapShape): string =>
      shape
        .map((command): string => {
          switch (command.op) {
            case 'M':
            case 'L':
              return `${command.op}${at(command.to)}`;
            case 'C':
              return `C${at(command.c1)} ${at(command.c2)} ${at(command.to)}`;
            case 'Z':
              return 'Z';
          }
        })
        .join(' '),
    )
    .join(' ');
}

/** Centre lines of the streets of one weight. */
function streetsOf(weight: MapStreetWeight): MapShape[] {
  return MAP_STREETS.filter((street): boolean => street.weight === weight).map((street): MapShape => street.path);
}

/** Share of the route drawn at scene progress `p`: 0 to 1, complete at `ROUTE_DONE_AT`. */
function routeHead(p: number): number {
  'worklet';
  return clamp(p / ROUTE_DONE_AT, 0, 1);
}

/** A route measured for the current canvas size. */
interface RouteGeometry {
  /** Canvas position and size of the route's own Svg, dp. */
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  /** Polyline path data, local to the route's Svg. */
  readonly d: string;
  /** Polyline length, dp. */
  readonly length: number;
  /** Share of the length reached at each vertex, 0 to 1. */
  readonly stops: readonly number[];
  /** Canvas position of each vertex, dp. */
  readonly xs: readonly number[];
  readonly ys: readonly number[];
}

/** Measures a route on a canvas `width` by `height` dp. */
function measureRoute(route: MapRoute, width: number, height: number): RouteGeometry {
  const xs = route.points.map((point: MapPoint): number => point.x * width);
  const ys = route.points.map((point: MapPoint): number => point.y * height);
  const left = Math.min(...xs) - ROUTE_PAD;
  const top = Math.min(...ys) - ROUTE_PAD;
  const segments = xs
    .slice(1)
    .map((x: number, index: number): number => Math.hypot(x - xs[index], ys[index + 1] - ys[index]));
  const reached = segments.reduce(
    (sums: number[], segment: number): number[] => [...sums, sums[sums.length - 1] + segment],
    [0],
  );
  const length = reached[reached.length - 1];
  return {
    left,
    top,
    width: Math.max(...xs) + ROUTE_PAD - left,
    height: Math.max(...ys) + ROUTE_PAD - top,
    d: xs
      .map(
        (x: number, index: number): string => `${index === 0 ? 'M' : 'L'}${round(x - left)} ${round(ys[index] - top)}`,
      )
      .join(' '),
    length,
    stops: reached.map((distance: number, index: number): number =>
      length > 0 ? distance / length : index / segments.length,
    ),
    xs,
    ys,
  };
}

/** Props for {@link StaticMap}. */
interface StaticMapProps {
  readonly width: number;
  readonly height: number;
  readonly colors: Palette;
}

/** The city ground: land, blocks, streets, parks and the river with its bridges. Never animates. */
const StaticMap = memo(function StaticMap({ width, height, colors }: StaticMapProps): ReactElement {
  const paths = useMemo(
    (): Record<'blocks' | 'parks' | 'river' | 'minor' | 'major', string> => ({
      blocks: toPathData(MAP_BLOCKS, width, height),
      parks: toPathData(MAP_PARKS, width, height),
      river: toPathData([MAP_RIVER], width, height),
      minor: toPathData(streetsOf('minor'), width, height),
      major: toPathData(streetsOf('major'), width, height),
    }),
    [width, height],
  );

  return (
    <Svg width={width} height={height}>
      <Rect width={width} height={height} fill={colors['map-land']} />
      <Path
        d={paths.blocks}
        fill={colors['map-block']}
        stroke={colors['map-block']}
        strokeWidth={MAP_STROKE.block}
        strokeLinejoin="round"
      />
      <Path
        d={paths.minor}
        fill="none"
        stroke={colors['map-land']}
        strokeWidth={MAP_STROKE.road + 2 * MAP_STROKE.casingGap}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d={paths.minor}
        fill="none"
        stroke={colors['map-road']}
        strokeWidth={MAP_STROKE.road}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d={paths.parks}
        fill={colors['map-park']}
        stroke={colors['map-park']}
        strokeWidth={MAP_STROKE.park}
        strokeLinejoin="round"
      />
      <Path
        d={paths.river}
        fill="none"
        stroke={colors['map-land']}
        strokeWidth={MAP_STROKE.riverBank}
        strokeLinecap="round"
      />
      <Path
        d={paths.river}
        fill="none"
        stroke={colors['map-water']}
        strokeWidth={MAP_STROKE.river}
        strokeLinecap="round"
      />
      <Path
        d={paths.major}
        fill="none"
        stroke={colors['map-land']}
        strokeWidth={MAP_STROKE.roadMajor + 2 * MAP_STROKE.casingGap}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d={paths.major}
        fill="none"
        stroke={colors['map-road-major']}
        strokeWidth={MAP_STROKE.roadMajor}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
});

/** Props shared by the moving parts of a scene. */
interface ScenePartProps {
  /** Scene progress, 0 to 1. */
  readonly progress: DerivedValue<number>;
  readonly colors: Palette;
}

/** Props for {@link Route}. */
interface RouteProps extends ScenePartProps {
  readonly geometry: RouteGeometry;
}

/** A route line over its glow, in its own small Svg, drawn up to the puck. */
function Route({ geometry, progress, colors }: RouteProps): ReactElement {
  const frame = useMemo(
    (): ViewStyle => ({
      position: 'absolute',
      left: geometry.left,
      top: geometry.top,
      width: geometry.width,
      height: geometry.height,
    }),
    [geometry],
  );
  const { length } = geometry;
  const glowProps = useAnimatedProps(
    (): Partial<PathProps> => ({ strokeDashoffset: length * (1 - routeHead(progress.get())) }),
  );
  const lineProps = useAnimatedProps(
    (): Partial<PathProps> => ({ strokeDashoffset: length * (1 - routeHead(progress.get())) }),
  );

  return (
    <View style={frame}>
      <Svg width={geometry.width} height={geometry.height}>
        <AnimatedPath
          d={geometry.d}
          fill="none"
          stroke={colors['primary-glow']}
          strokeWidth={MAP_STROKE.routeGlow}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={[length, length]}
          animatedProps={glowProps}
        />
        <AnimatedPath
          d={geometry.d}
          fill="none"
          stroke={colors.primary}
          strokeWidth={MAP_STROKE.route}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={[length, length]}
          animatedProps={lineProps}
        />
      </Svg>
    </View>
  );
}

/** Props for {@link Puck}. */
interface PuckProps extends ScenePartProps {
  readonly geometry: RouteGeometry;
  readonly tone: MapRoute['puck'];
}

/** A location puck riding the head of its route. */
function Puck({ geometry, tone, progress, colors }: PuckProps): ReactElement {
  const disc = useMemo(
    (): ViewStyle => ({
      position: 'absolute',
      left: -PUCK_SIZE / 2,
      top: -PUCK_SIZE / 2,
      width: PUCK_SIZE,
      height: PUCK_SIZE,
      borderRadius: PUCK_SIZE / 2,
      borderWidth: PUCK_RING,
      borderColor: colors.background,
      backgroundColor: colors[tone],
    }),
    [colors, tone],
  );
  const { stops, xs, ys } = geometry;
  const motion = useAnimatedStyle((): ViewStyle => {
    const head = routeHead(progress.get());
    return {
      transform: [
        { translateX: interpolate(head, stops, xs, Extrapolation.CLAMP) },
        { translateY: interpolate(head, stops, ys, Extrapolation.CLAMP) },
      ],
    };
  });

  return <Animated.View style={[disc, motion]} />;
}

/** Props for {@link Dot}. */
interface DotProps extends ScenePartProps {
  readonly dot: MapDot;
  readonly width: number;
  readonly height: number;
}

/** A small ambient event dot that fades in as the scene plays. */
function Dot({ dot, width, height, progress, colors }: DotProps): ReactElement {
  const base = useMemo(
    (): ViewStyle => ({
      position: 'absolute',
      left: dot.at.x * width - DOT_SIZE / 2,
      top: dot.at.y * height - DOT_SIZE / 2,
      width: DOT_SIZE,
      height: DOT_SIZE,
      borderRadius: DOT_SIZE / 2,
      backgroundColor: colors.primary,
    }),
    [dot, width, height, colors],
  );
  const { appearAt } = dot;
  const fade = useAnimatedStyle(
    (): ViewStyle => ({
      opacity: interpolate(progress.get(), [appearAt, appearAt + DOT_FADE], [0, 1], Extrapolation.CLAMP),
    }),
  );

  return <Animated.View style={[base, fade]} />;
}

/** Props for {@link Pin}. */
interface PinProps extends ScenePartProps {
  readonly scene: MapScene;
  readonly width: number;
  readonly height: number;
  /** Whether the ring pulses: the scene's slide is settled and motion is allowed. */
  readonly pulsing: boolean;
}

/** The event pin with its pulsing ring; it pops in as the route completes. */
function Pin({ scene, width, height, pulsing, progress, colors }: PinProps): ReactElement {
  const Icon: LucideIcon = PIN_ICONS[scene.key];
  const frame = useMemo(
    (): ViewStyle => ({
      position: 'absolute',
      left: scene.pin.x * width - PIN_SIZE / 2,
      top: scene.pin.y * height - PIN_SIZE / 2,
      width: PIN_SIZE,
      height: PIN_SIZE,
    }),
    [scene, width, height],
  );
  const ring = useMemo(
    (): ViewStyle => ({
      position: 'absolute',
      top: 0,
      left: 0,
      width: PIN_SIZE,
      height: PIN_SIZE,
      borderRadius: PIN_SIZE / 2,
      backgroundColor: colors['primary-glow'],
      opacity: 0,
    }),
    [colors],
  );
  const appear = useAnimatedStyle((): ViewStyle => {
    const p = progress.get();
    return {
      opacity: interpolate(p, PIN_FADE, [0, 1], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(p, PIN_FADE, [0.9, 1], Extrapolation.CLAMP) }],
    };
  });

  return (
    <Animated.View style={[frame, appear]}>
      <Animated.View style={[ring, pulsing ? PULSE : NO_PULSE]} />
      <Capsule tone="primary" radius={PIN_SIZE / 2} style={styles.pin}>
        <Icon size={PIN_ICON_SIZE} color={colors['primary-foreground']} />
      </Capsule>
    </Animated.View>
  );
}

/** Props for {@link Scene}. */
interface SceneProps {
  readonly scene: MapScene;
  /** Slide index of the scene. */
  readonly index: number;
  /** Pager position in slides. */
  readonly page: DerivedValue<number>;
  readonly intro: SharedValue<number> | DerivedValue<number>;
  /** Whether this scene's slide is settled. */
  readonly active: boolean;
  /** Canvas size, dp. */
  readonly width: number;
  readonly height: number;
  readonly colors: Palette;
}

/** One slide's story: routes, pucks, dots and the pin, shown only around its own slide. */
function Scene({ scene, index, page, intro, active, width, height, colors }: SceneProps): ReactElement {
  const reducedMotion = useReducedMotion();
  const progress = useDerivedValue((): number => (index === 0 ? intro.get() : clamp(page.get() - (index - 1), 0, 1)));
  const visibility = useAnimatedStyle((): ViewStyle => {
    const at = page.get();
    return {
      opacity:
        index === 0
          ? interpolate(at, [0, 0.5], [1, 0], Extrapolation.CLAMP)
          : interpolate(at, [index - 1, index - 0.9, index, index + 0.5], [0, 1, 1, 0], Extrapolation.CLAMP),
    };
  });
  const routes = useMemo(
    (): RouteGeometry[] => scene.routes.map((route: MapRoute): RouteGeometry => measureRoute(route, width, height)),
    [scene, width, height],
  );

  return (
    <Animated.View style={[StyleSheet.absoluteFill, visibility]}>
      {routes.map(
        (geometry: RouteGeometry, routeIndex: number): ReactElement => (
          <Route key={`route-${routeIndex}`} geometry={geometry} progress={progress} colors={colors} />
        ),
      )}
      {routes.map(
        (geometry: RouteGeometry, routeIndex: number): ReactElement => (
          <Puck
            key={`puck-${routeIndex}`}
            geometry={geometry}
            tone={scene.routes[routeIndex].puck}
            progress={progress}
            colors={colors}
          />
        ),
      )}
      {scene.dots.map(
        (dot: MapDot, dotIndex: number): ReactElement => (
          <Dot key={`dot-${dotIndex}`} dot={dot} width={width} height={height} progress={progress} colors={colors} />
        ),
      )}
      <Pin
        scene={scene}
        width={width}
        height={height}
        pulsing={active && !reducedMotion}
        progress={progress}
        colors={colors}
      />
    </Animated.View>
  );
}

/** Props for {@link OnboardingMap}. */
export interface OnboardingMapProps {
  /** Horizontal scroll offset of the slide pager, dp. */
  scrollX: SharedValue<number>;
  /** Width of one slide, dp (the window width). */
  pageWidth: number;
  /** Height of the map area, dp. */
  height: number;
  /** Entrance progress of the first scene, 0 to 1. Scenes two and three follow `scrollX`. */
  intro: SharedValue<number> | DerivedValue<number>;
  /** Index of the settled slide; only that scene's pin pulses. */
  activeIndex: number;
}

/**
 * The street map of a river city behind the Welcome models. The canvas is two slides wide and pans
 * at half the pager's speed. Each slide has a scene: a puck follows a route to an event pin, drawn
 * by `intro` for the first slide and by the swipe itself for the others, so a reversed swipe undraws
 * it. Only the settled slide's pin pulses, and never under reduced motion. Decorative: hidden from
 * touch and screen readers. Per frame only the arriving route's small Svg and a few transformed
 * views update; nothing re-renders during a scroll.
 *
 * @example
 * const scrollX = useSharedValue(0);
 * const intro = useSharedValue(0);
 * intro.set(withTiming(1, { duration: 1200, easing: EASE_OUT }));
 * <OnboardingMap scrollX={scrollX} pageWidth={width} height={mapHeight} intro={intro} activeIndex={index} />
 */
export function OnboardingMap({ scrollX, pageWidth, height, intro, activeIndex }: OnboardingMapProps): ReactElement {
  const theme = useResolvedTheme();
  const colors: Palette = Colors[theme];
  const canvasWidth = 2 * pageWidth;

  const page = useDerivedValue((): number => (pageWidth > 0 ? scrollX.get() / pageWidth : 0));

  const rootStyle = useMemo((): ViewStyle => ({ width: pageWidth, height, overflow: 'hidden' }), [pageWidth, height]);
  const canvasStyle = useMemo(
    (): ViewStyle => ({ position: 'absolute', top: 0, left: 0, width: canvasWidth, height }),
    [canvasWidth, height],
  );
  const pan = useAnimatedStyle((): ViewStyle => ({ transform: [{ translateX: -scrollX.get() * PARALLAX }] }));

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={rootStyle}
    >
      <Animated.View style={[canvasStyle, pan]}>
        <StaticMap width={canvasWidth} height={height} colors={colors} />
        {MAP_SCENES.map(
          (scene: MapScene, index: number): ReactElement => (
            <Scene
              key={scene.key}
              scene={scene}
              index={index}
              page={page}
              intro={intro}
              active={activeIndex === index}
              width={canvasWidth}
              height={height}
              colors={colors}
            />
          ),
        )}
      </Animated.View>
    </View>
  );
}

/** Static layout of the pin capsule. */
const styles = StyleSheet.create({
  pin: { width: PIN_SIZE, height: PIN_SIZE, alignItems: 'center', justifyContent: 'center' },
});
