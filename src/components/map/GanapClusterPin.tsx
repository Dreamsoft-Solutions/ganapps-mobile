import { Image } from 'expo-image';
import { type ReactElement, useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  type EasingFunctionFactory,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Capsule } from '@/components/common/Capsule';
import { Text } from '@/components/common/Text';
import { Colors, Shadows } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';

/** The most event faces a cluster shows around its count. */
export const CLUSTER_PREVIEW_LIMIT: number = 3;

const FACE_SIZE: number = 26;
const FACE_BEZEL: number = 2;
const ORBIT_GAP: number = 6;
const HALO_WIDTH: number = 6;
const ORBIT_PERIOD_MS: number = 24000;
const EMERGE_MS: number = 420;
const EMERGE_STAGGER_MS: number = 70;
const FULL_TURN: number = Math.PI * 2;
/** Largest text scale for the count: the disc is a fixed size so the group reads as one mark. */
const COUNT_MAX_SCALE: number = 1.2;
const EASE_OUT: EasingFunctionFactory = Easing.bezier(0.23, 1, 0.32, 1);

/** Disc diameter by group size, stepping up at 5 and 10 as the Ganapps Glass ClusterPin does. */
function discSize(count: number): number {
  if (count >= 10) return 56;
  if (count >= 5) return 50;
  return 44;
}

/** Where face `index` of `total` rests on the orbit, in radians, starting at the top. */
function restingAngle(index: number, total: number): number {
  const offset: number = total === 1 ? Math.PI / 4 : 0;
  return -Math.PI / 2 + offset + (index * FULL_TURN) / total;
}

interface MoonProps {
  readonly uri: string;
  readonly index: number;
  readonly total: number;
  readonly radius: number;
  readonly center: number;
  readonly turn: SharedValue<number>;
  readonly reduceMotion: boolean;
}

/** One event face on the orbit. It springs out from behind the disc when the cluster appears. */
function Moon({ uri, index, total, radius, center, turn, reduceMotion }: MoonProps): ReactElement {
  const theme = useResolvedTheme();
  const spread = useSharedValue<number>(reduceMotion ? 1 : 0);
  const angle: number = restingAngle(index, total);

  useEffect((): void => {
    if (reduceMotion) return;
    spread.set(withDelay(index * EMERGE_STAGGER_MS, withTiming(1, { duration: EMERGE_MS, easing: EASE_OUT })));
  }, [index, reduceMotion, spread]);

  const style = useAnimatedStyle(
    (): {
      opacity: number;
      transform: ({ translateX: number } | { translateY: number } | { scale: number })[];
    } => {
      const at: number = angle + turn.get();
      const reach: number = radius * spread.get();
      return {
        opacity: spread.get(),
        transform: [
          { translateX: reach * Math.cos(at) },
          { translateY: reach * Math.sin(at) },
          { scale: 0.6 + 0.4 * spread.get() },
        ],
      };
    },
  );

  return (
    <Animated.View
      accessible={false}
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: center - FACE_SIZE / 2,
          top: center - FACE_SIZE / 2,
          width: FACE_SIZE,
          height: FACE_SIZE,
          padding: FACE_BEZEL,
          borderRadius: FACE_SIZE / 2,
          backgroundColor: Colors[theme]['glass-fill-solid'],
          boxShadow: `0 0 0 1px ${Colors[theme]['glass-rim']}, ${Shadows[theme].md}`,
        },
        style,
      ]}
    >
      <Image
        source={{ uri }}
        contentFit="cover"
        recyclingKey={uri}
        style={{ flex: 1, borderRadius: (FACE_SIZE - 2 * FACE_BEZEL) / 2 }}
      />
    </Animated.View>
  );
}

/** Props for {@link GanapClusterPin}. */
export interface GanapClusterPinProps {
  /** How many Ganaps the group holds; sizes the disc. */
  readonly count: number;
  /** The count as shown, abbreviated for large groups (`1.2k`). */
  readonly countLabel: string;
  /** Up to {@link CLUSTER_PREVIEW_LIMIT} distinct pin images from the group's Ganaps. */
  readonly images: readonly string[];
  /** Whether the faces orbit. Off while the map is not on screen, so hidden tabs cost nothing. */
  readonly isAnimating: boolean;
}

/**
 * A group of nearby Ganaps on the map: the count on a lit `primary` capsule ringed by a tinted
 * halo, with up to three of the group's event pin images orbiting it as small glass-rimmed faces,
 * so a group previews what is inside before it is opened.
 *
 * The faces spring out from behind the disc one after another when the group appears, then drift
 * round once every 24 seconds, slow enough to read as alive rather than busy. With Reduce Motion
 * they rest in a still fan. A group with no images is the disc and halo alone.
 *
 * The parent supplies the press target and its label; every face is hidden from accessibility.
 *
 * @param props - The group size, its label, preview images and whether to animate.
 * @returns The cluster marker body.
 */
export function GanapClusterPin({ count, countLabel, images, isAnimating }: GanapClusterPinProps): ReactElement {
  const theme = useResolvedTheme();
  const reduceMotion: boolean = useReducedMotion();
  const turn = useSharedValue<number>(0);

  const disc: number = discSize(count);
  const radius: number = disc / 2 + ORBIT_GAP;
  const faces: readonly string[] = images.slice(0, CLUSTER_PREVIEW_LIMIT);
  const bounds: number = faces.length > 0 ? 2 * (radius + FACE_SIZE / 2) : disc + 2 * HALO_WIDTH;
  const center: number = bounds / 2;

  useEffect((): (() => void) => {
    if (isAnimating && !reduceMotion && faces.length > 0) {
      turn.set(
        withRepeat(withTiming(turn.get() + FULL_TURN, { duration: ORBIT_PERIOD_MS, easing: Easing.linear }), -1, false),
      );
    } else {
      cancelAnimation(turn);
    }
    return (): void => cancelAnimation(turn);
  }, [isAnimating, reduceMotion, faces.length, turn]);

  return (
    <View testID="ganap-cluster-pin" style={{ width: bounds, height: bounds }}>
      <View
        style={{
          position: 'absolute',
          left: center - disc / 2,
          top: center - disc / 2,
          width: disc,
          height: disc,
          borderRadius: disc / 2,
          boxShadow: `0 0 0 ${HALO_WIDTH}px ${Colors[theme]['glass-tint-primary']}`,
        }}
      >
        <Capsule tone="primary" className="flex-1 items-center justify-center">
          <Text
            className="font-allo-bold text-body-lg"
            style={{ color: Colors[theme]['primary-foreground'] }}
            maxFontSizeMultiplier={COUNT_MAX_SCALE}
          >
            {countLabel}
          </Text>
        </Capsule>
      </View>
      {faces.map(
        (uri: string, index: number): ReactElement => (
          <Moon
            key={uri}
            uri={uri}
            index={index}
            total={faces.length}
            radius={radius}
            center={center}
            turn={turn}
            reduceMotion={reduceMotion}
          />
        ),
      )}
    </View>
  );
}
