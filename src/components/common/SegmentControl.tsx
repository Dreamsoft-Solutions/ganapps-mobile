import type { ReactElement } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/common/Text';
import { Colors } from '@/constants/theme';
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
 * collection.
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

  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} className="mb-md flex-row rounded-lg bg-muted p-xs">
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
            style={
              selected
                ? {
                    backgroundColor: Colors[theme].card,
                    boxShadow: '0px 1px 2px 0px rgba(0, 0, 0, 0.05)',
                  }
                : undefined
            }
          >
            <Text
              className="text-label-md"
              style={{ color: selected ? Colors[theme].primary : Colors[theme]['muted-foreground'] }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
