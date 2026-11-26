import { useEffect, useRef, useState, type ReactElement } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Capsule } from '@/components/common/Capsule';
import { Text } from '@/components/common/Text';
import { BorderRadius, Colors, Shadows, Spacing } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';

/** One selectable option in a {@link SegmentControl}. */
export interface SegmentControlOption<T extends string> {
  value: T;
  label: string;
}

/** Props for {@link SegmentControl}. */
export interface SegmentControlProps<T extends string> {
  value: T;
  options: ReadonlyArray<SegmentControlOption<T>>;
  onChange: (value: T) => void;
  label: string;
}

/**
 * The classes one segment option renders.
 *
 * Exported so `SegmentControl.test.tsx` can resolve the rendered touch target
 * against the real Tailwind theme. Sized from the `touch` token rather than the
 * numeric scale: NativeWind substitutes 14px for `1rem`, so `min-h-12` renders
 * 42dp and would miss the floor ADR 0005 binds. See DS-119.
 */
export const SEGMENT_OPTION_CLASSES: string = 'min-h-touch flex-1 items-center justify-center rounded-md px-sm';

/**
 * Horizontal control for switching between mutually exclusive views of one
 * collection. A card capsule (the lens) sits under the active option and
 * slides to the new one on change; its first position is set without motion.
 *
 * @param props - Selected value, the options, a change handler, and a group label.
 * @returns An accessible tablist of segment options.
 */
export function SegmentControl<T extends string>({
  value,
  options,
  onChange,
  label,
}: SegmentControlProps<T>): ReactElement {
  const theme = useResolvedTheme();
  const [trackWidth, setTrackWidth] = useState<number>(0);
  const lensX = useSharedValue<number>(0);
  const placed = useRef<boolean>(false);

  const index: number = options.findIndex((option: SegmentControlOption<T>): boolean => option.value === value);
  const optionWidth: number = options.length > 0 ? Math.max(trackWidth - 2 * Spacing.xs, 0) / options.length : 0;

  const lensStyle = useAnimatedStyle((): { transform: { translateX: number }[] } => ({
    transform: [{ translateX: lensX.get() }],
  }));

  const handleLayout = (event: LayoutChangeEvent): void => {
    const width: number = event.nativeEvent.layout.width;
    if (!placed.current && index >= 0 && options.length > 0) {
      lensX.set((index * Math.max(width - 2 * Spacing.xs, 0)) / options.length);
      placed.current = true;
    }
    setTrackWidth(width);
  };

  useEffect((): void => {
    if (!placed.current || index < 0 || optionWidth <= 0) {
      return;
    }
    lensX.set(withSpring(index * optionWidth, { duration: 380, dampingRatio: 1, reduceMotion: ReduceMotion.System }));
  }, [index, optionWidth, lensX]);

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      onLayout={handleLayout}
      className="mb-md flex-row rounded-xl bg-muted p-xs"
      style={{ boxShadow: Shadows[theme].well }}
    >
      {trackWidth > 0 && index >= 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            { position: 'absolute', top: Spacing.xs, bottom: Spacing.xs, left: Spacing.xs, width: optionWidth },
            lensStyle,
          ]}
        >
          <Capsule tone="card" glow={false} radius={BorderRadius.md} style={{ flexGrow: 1 }} />
        </Animated.View>
      ) : null}
      {options.map((option: SegmentControlOption<T>): ReactElement => {
        const selected: boolean = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={(): void => onChange(option.value)}
            className={SEGMENT_OPTION_CLASSES}
          >
            <Text
              className={selected ? 'font-allo-semibold text-label-md' : 'text-label-md'}
              style={{ color: selected ? Colors[theme]['primary-text'] : Colors[theme]['muted-foreground'] }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
