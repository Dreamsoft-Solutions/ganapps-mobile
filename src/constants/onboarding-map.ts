import type { OnboardingSlide } from '@/constants/onboarding';
import type { ThemeColor } from '@/constants/theme';

/**
 * A point on the Welcome map canvas in unit coordinates: `x` is 0 to 1 of the canvas width (two
 * slides) and `y` is 0 to 1 of its height. The component multiplies by its real size, so the -12
 * degree street grid is baked into the numbers and every route still lands on its street.
 */
export interface MapPoint {
  readonly x: number;
  readonly y: number;
}

/** One SVG path command in unit coordinates. */
export type MapPathCommand =
  | { readonly op: 'M' | 'L'; readonly to: MapPoint }
  | { readonly op: 'C'; readonly c1: MapPoint; readonly c2: MapPoint; readonly to: MapPoint }
  | { readonly op: 'Z' };

/** An outline or a line on the map: path commands in unit coordinates. */
export type MapShape = readonly MapPathCommand[];

/** Street class: a thin minor road or a wide major road. */
export type MapStreetWeight = 'minor' | 'major';

/** One drawn street. */
export interface MapStreet {
  /** Which stroke and colour it is drawn with. */
  readonly weight: MapStreetWeight;
  /** Its centre line. */
  readonly path: MapShape;
}

/** Theme colour of a location puck. */
export type MapPuckTone = Extract<ThemeColor, 'brand-lime' | 'mint'>;

/** A puck's journey to the pin. */
export interface MapRoute {
  /** Vertices on street centre lines: the first just past the screen edge, the last on the pin. */
  readonly points: readonly MapPoint[];
  /** Colour of the puck that travels it. */
  readonly puck: MapPuckTone;
}

/** A small ambient event dot. */
export interface MapDot {
  /** Centre of the dot. */
  readonly at: MapPoint;
  /** Scene progress at which it starts to fade in, 0 to 1. */
  readonly appearAt: number;
}

/** The story drawn for one Welcome slide. */
export interface MapScene {
  /** The slide this scene belongs to. */
  readonly key: OnboardingSlide['key'];
  /** Centre of the event pin; every route ends exactly here. */
  readonly pin: MapPoint;
  /** Routes drawn as the scene plays. */
  readonly routes: readonly MapRoute[];
  /** Ambient dots shown with the scene. */
  readonly dots: readonly MapDot[];
}

/** Stroke widths of the map layers, dp. */
export interface MapStrokes {
  /** Minor road. */
  readonly road: number;
  /** Major road, which also bridges the river. */
  readonly roadMajor: number;
  /** Land-coloured gap on each side of a road, between it and the blocks. */
  readonly casingGap: number;
  /** River water. */
  readonly river: number;
  /** Land-coloured bank under the water, so roads stop short of it. */
  readonly riverBank: number;
  /** Block outline, which rounds the block corners. */
  readonly block: number;
  /** Park outline, which rounds the park corners. */
  readonly park: number;
  /** Route line. */
  readonly route: number;
  /** Glow under the route line. */
  readonly routeGlow: number;
}

/**
 * Stroke widths of the map layers, dp. A road's casing is `road + 2 * casingGap` wide.
 *
 * @example
 * <Path d={roads} stroke={colors['map-road']} strokeWidth={MAP_STROKE.road} />
 */
export const MAP_STROKE: MapStrokes = {
  road: 6,
  roadMajor: 10,
  casingGap: 3,
  river: 44,
  riverBank: 52,
  block: 8,
  park: 24,
  route: 5,
  routeGlow: 12,
};

/** Reference canvas width the geometry is designed at, dp: two 411dp slides. */
const FRAME_WIDTH = 822;
/** Reference canvas height the geometry is designed at, dp. */
const FRAME_HEIGHT = 520;
/** Reference width of one slide, dp. */
const SLIDE_WIDTH = 411;
/** Centre of the grid rotation, reference dp. */
const CX: number = FRAME_WIDTH / 2;
/** Centre of the grid rotation, reference dp. */
const CY: number = FRAME_HEIGHT / 2;
/** Rotation of the street grid: rows climb to the right. */
const GRID_ANGLE: number = (-12 * Math.PI) / 180;
/** Cosine of the grid rotation. */
const COS: number = Math.cos(GRID_ANGLE);
/** Sine of the grid rotation. */
const SIN: number = Math.sin(GRID_ANGLE);
/** How far past the screen edge a route starts, so its puck slides in from off screen, dp. */
const EDGE_OVERSHOOT = 12;

/** A point in the unrotated street frame, reference dp: `sx` runs along rows, `sy` along columns. */
type StreetCoord = readonly [sx: number, sy: number];

/** A rectangle in the street frame, bounded by street centre lines. */
interface StreetRect {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

/** One straight street of the grid, in the street frame. */
interface GridLine {
  /** Where it sits: `sx` of a column or `sy` of a row. */
  readonly at: number;
  readonly weight: MapStreetWeight;
  /** Where it starts and ends along its own direction. */
  readonly from: number;
  readonly to: number;
}

/** Converts reference canvas dp to unit coordinates. */
function fromFrame(x: number, y: number): MapPoint {
  return { x: x / FRAME_WIDTH, y: y / FRAME_HEIGHT };
}

/** Rotates a street-frame point onto the canvas. */
function fromStreet([sx, sy]: StreetCoord): MapPoint {
  const dx = sx - CX;
  const dy = sy - CY;
  return fromFrame(CX + dx * COS - dy * SIN, CY + dx * SIN + dy * COS);
}

/** Rotates a canvas point back into the street frame. */
function toStreet(point: MapPoint): StreetCoord {
  const dx = point.x * FRAME_WIDTH - CX;
  const dy = point.y * FRAME_HEIGHT - CY;
  return [CX + dx * COS + dy * SIN, CY - dx * SIN + dy * COS];
}

/** The street-frame `sx` at which the row at `sy` crosses the canvas x `frameX`. */
function rowAt(sy: number, frameX: number): number {
  return CX + (frameX - CX + (sy - CY) * SIN) / COS;
}

/** Converts a position on slide `index`, as fractions of the screen, to canvas unit coordinates. */
function slidePoint(index: number, screenX: number, screenY: number): MapPoint {
  return { x: (screenX + 0.5 * index) / 2, y: screenY };
}

/** Pin of the `find` scene. */
const PIN_FIND: MapPoint = slidePoint(0, 0.24, 0.2);
/** Pin of the `plan` scene. */
const PIN_PLAN: MapPoint = slidePoint(1, 0.5, 0.13);
/** Pin of the `keep` scene. */
const PIN_KEEP: MapPoint = slidePoint(2, 0.64, 0.16);

/** The column and row that cross under the `find` pin. */
const [FIND_COL, FIND_ROW]: StreetCoord = toStreet(PIN_FIND);
/** The column and row that cross under the `plan` pin. */
const [PLAN_COL, PLAN_ROW]: StreetCoord = toStreet(PIN_PLAN);
/** The column and row that cross under the `keep` pin. */
const [KEEP_COL, KEEP_ROW]: StreetCoord = toStreet(PIN_KEEP);

/** A column street; the default run covers the whole canvas. */
function column(at: number, weight: MapStreetWeight = 'minor', from = -190, to = 720): GridLine {
  return { at, weight, from, to };
}

/** A row street; the default run covers the whole canvas. */
function row(at: number, weight: MapStreetWeight = 'minor', from = -140, to = 980): GridLine {
  return { at, weight, from, to };
}

/** Column streets, left to right. Column 40 stops at the first park, and 300 and 610 are avenues. */
const COLUMNS: readonly GridLine[] = [
  column(-110),
  column(-30),
  column(40, 'minor', -190, KEEP_ROW),
  column(40, 'minor', 230, 720),
  column(FIND_COL),
  column(215),
  column(300, 'major'),
  column(370),
  column(PLAN_COL),
  column(530),
  column(610, 'major'),
  column(KEEP_COL),
  column(780),
  column(860),
  column(940),
];

/** Row streets, top to bottom. Two short rows make the blocks uneven; 230 is the main avenue. */
const ROWS: readonly GridLine[] = [
  row(-160),
  row(-60),
  row(FIND_ROW, 'minor', -140, 300),
  row(PLAN_ROW, 'minor', 370, 610),
  row(KEEP_ROW),
  row(230, 'major'),
  row(330),
  row(420),
  row(520),
  row(610),
  row(700),
];

/** Park areas, each bounded by streets. */
const PARK_RECTS: readonly StreetRect[] = [
  { left: -30, right: FIND_COL, top: KEEP_ROW, bottom: 230 },
  { left: 530, right: 610, top: PLAN_ROW, bottom: KEEP_ROW },
  { left: KEEP_COL, right: 780, top: 330, bottom: 420 },
];

/** River centre line through reference canvas dp, upstream at the top right. */
const RIVER_FRAME: readonly (readonly [number, number])[] = [
  [-70, 520],
  [200, 445],
  [400, 340],
  [520, 220],
  [600, 100],
  [690, -70],
];

/** Half the drawn width of a street of this weight, dp. */
function halfRoad(weight: MapStreetWeight): number {
  return (weight === 'major' ? MAP_STROKE.roadMajor : MAP_STROKE.road) / 2;
}

/** Weight of the street at `at` among `lines`. */
function weightAt(lines: readonly GridLine[], at: number): MapStreetWeight {
  return lines.find((line): boolean => line.at === at)?.weight ?? 'minor';
}

/** Each value paired with the next one. */
function consecutive(values: readonly number[]): (readonly [number, number])[] {
  return values.slice(1).map((value, index): readonly [number, number] => [values[index], value]);
}

/** Sorted distinct values. */
function distinct(values: readonly number[]): number[] {
  return [...new Set(values)].sort((a, b): number => a - b);
}

/**
 * Outline of the area between four streets, pulled in so that a fill stroked `stroke` wide leaves a
 * casing gap beside each road. Returns `undefined` when nothing is left.
 */
function insetRect(rect: StreetRect, stroke: number): MapShape | undefined {
  const inset = (weight: MapStreetWeight): number => halfRoad(weight) + MAP_STROKE.casingGap + stroke / 2;
  const x0 = rect.left + inset(weightAt(COLUMNS, rect.left));
  const x1 = rect.right - inset(weightAt(COLUMNS, rect.right));
  const y0 = rect.top + inset(weightAt(ROWS, rect.top));
  const y1 = rect.bottom - inset(weightAt(ROWS, rect.bottom));
  if (x1 <= x0 || y1 <= y0) {
    return undefined;
  }
  return [
    { op: 'M', to: fromStreet([x0, y0]) },
    { op: 'L', to: fromStreet([x1, y0]) },
    { op: 'L', to: fromStreet([x1, y1]) },
    { op: 'L', to: fromStreet([x0, y1]) },
    { op: 'Z' },
  ];
}

/** Whether a street-frame point lies inside a park. */
function inPark(sx: number, sy: number): boolean {
  return PARK_RECTS.some((park): boolean => sx > park.left && sx < park.right && sy > park.top && sy < park.bottom);
}

/** One block per grid cell, skipping the cells a park takes. */
function buildBlocks(): MapShape[] {
  const columns = distinct(COLUMNS.map((line): number => line.at));
  return consecutive(columns).flatMap(([left, right]): MapShape[] => {
    const crossing = ROWS.filter((line): boolean => line.from <= left && line.to >= right);
    const rows = distinct(crossing.map((line): number => line.at));
    return consecutive(rows).flatMap(([top, bottom]): MapShape[] => {
      if (inPark((left + right) / 2, (top + bottom) / 2)) {
        return [];
      }
      const shape = insetRect({ left, right, top, bottom }, MAP_STROKE.block);
      return shape ? [shape] : [];
    });
  });
}

/** A straight polyline through street-frame points. */
function polyline(points: readonly StreetCoord[]): MapShape {
  return points.map((point, index): MapPathCommand => ({ op: index === 0 ? 'M' : 'L', to: fromStreet(point) }));
}

/** A smooth curve through reference canvas points (Catmull-Rom as cubic Beziers). */
function smoothCurve(points: readonly (readonly [number, number])[]): MapShape {
  const at = (index: number): readonly [number, number] => points[Math.min(Math.max(index, 0), points.length - 1)];
  const curves = points.slice(1).map((end, step): MapPathCommand => {
    const [x0, y0] = at(step - 1);
    const [x1, y1] = at(step);
    const [x2, y2] = end;
    const [x3, y3] = at(step + 2);
    return {
      op: 'C',
      c1: fromFrame(x1 + (x2 - x0) / 6, y1 + (y2 - y0) / 6),
      c2: fromFrame(x2 - (x3 - x1) / 6, y2 - (y3 - y1) / 6),
      to: fromFrame(x2, y2),
    };
  });
  const [startX, startY] = at(0);
  return [{ op: 'M', to: fromFrame(startX, startY) }, ...curves];
}

/** A route from street-frame turns that ends exactly on `pin`. */
function route(puck: MapPuckTone, pin: MapPoint, turns: readonly StreetCoord[]): MapRoute {
  return { puck, points: [...turns.map(fromStreet), pin] };
}

/**
 * City blocks: rounded outlines filled and stroked in `map-block`, in unit coordinates.
 *
 * @example
 * <Path d={toPathData(MAP_BLOCKS, width, height)} fill={colors['map-block']} />
 */
export const MAP_BLOCKS: readonly MapShape[] = buildBlocks();

/**
 * Parks: rounded outlines filled and stroked in `map-park`, in unit coordinates.
 *
 * @example
 * <Path d={toPathData(MAP_PARKS, width, height)} fill={colors['map-park']} />
 */
export const MAP_PARKS: readonly MapShape[] = PARK_RECTS.flatMap((park): MapShape[] => {
  const shape = insetRect(park, MAP_STROKE.park);
  return shape ? [shape] : [];
});

/**
 * Centre line of the river, stroked `MAP_STROKE.river` wide in `map-water`. The three major
 * streets are drawn over it as bridges.
 *
 * @example
 * <Path d={toPathData([MAP_RIVER], width, height)} stroke={colors['map-water']} />
 */
export const MAP_RIVER: MapShape = smoothCurve(RIVER_FRAME);

/**
 * Every street centre line: the rotated grid plus a diagonal and a curved connector.
 *
 * @example
 * MAP_STREETS.filter((street) => street.weight === 'major');
 */
export const MAP_STREETS: readonly MapStreet[] = [
  ...COLUMNS.map(
    (line): MapStreet => ({
      weight: line.weight,
      path: polyline([
        [line.at, line.from],
        [line.at, line.to],
      ]),
    }),
  ),
  ...ROWS.map(
    (line): MapStreet => ({
      weight: line.weight,
      path: polyline([
        [line.from, line.at],
        [line.to, line.at],
      ]),
    }),
  ),
  {
    weight: 'minor',
    path: polyline([
      [530, 330],
      [610, 420],
      [KEEP_COL, 520],
      [800, 625],
    ]),
  },
  {
    weight: 'minor',
    path: [
      { op: 'M', to: fromStreet([370, 420]) },
      { op: 'C', c1: fromStreet([430, 425]), c2: fromStreet([470, 515]), to: fromStreet([530, 520]) },
    ],
  },
];

/**
 * The three Welcome scenes in slide order: `find`, `plan`, `keep`. Pins sit in the top 30% of their
 * slide and every route ends exactly on its pin.
 *
 * @example
 * MAP_SCENES.map((scene, index) => <Scene key={scene.key} scene={scene} index={index} />);
 */
export const MAP_SCENES: readonly MapScene[] = [
  {
    key: 'find',
    pin: PIN_FIND,
    routes: [
      route('brand-lime', PIN_FIND, [
        [rowAt(330, -EDGE_OVERSHOOT), 330],
        [215, 330],
        [215, 230],
        [FIND_COL, 230],
      ]),
    ],
    dots: [
      { at: fromStreet([75, FIND_ROW]), appearAt: 0.3 },
      { at: fromStreet([255, FIND_ROW]), appearAt: 0.5 },
      { at: fromStreet([300, 90]), appearAt: 0.7 },
    ],
  },
  {
    key: 'plan',
    pin: PIN_PLAN,
    routes: [
      route('brand-lime', PIN_PLAN, [
        [rowAt(KEEP_ROW, SLIDE_WIDTH / 2 - EDGE_OVERSHOOT), KEEP_ROW],
        [370, KEEP_ROW],
        [370, PLAN_ROW],
      ]),
      route('mint', PIN_PLAN, [
        [rowAt(230, SLIDE_WIDTH / 2 + SLIDE_WIDTH + EDGE_OVERSHOOT), 230],
        [PLAN_COL, 230],
      ]),
    ],
    dots: [],
  },
  {
    key: 'keep',
    pin: PIN_KEEP,
    routes: [
      route('brand-lime', PIN_KEEP, [
        [rowAt(330, FRAME_WIDTH + EDGE_OVERSHOOT), 330],
        [780, 330],
        [780, KEEP_ROW],
      ]),
    ],
    dots: [],
  },
];
