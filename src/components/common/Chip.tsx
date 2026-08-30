import { cva, type VariantProps } from 'class-variance-authority';
import { type ReactElement, useCallback } from 'react';
import { Pressable } from 'react-native';
import { Text } from './Text';

const chipVariants = cva('rounded-full border px-4 py-2 active:opacity-70', {
  variants: {
    selected: {
      true: 'border-primary bg-primary',
      false: 'border-input bg-background',
    },
  },
  defaultVariants: {
    selected: false,
  },
});

const textVariants = cva('text-body-md font-inter-semibold', {
  variants: {
    selected: {
      true: 'text-primary-foreground',
      false: 'text-foreground',
    },
  },
  defaultVariants: {
    selected: false,
  },
});

interface ChipProps extends VariantProps<typeof chipVariants> {
  label: string;
  selected: boolean;
  onPress: () => void;
}

/**
 * Selectable chip for interests, filters, or tags.
 *
 * @param props - Label, selection state, and press handler.
 * @returns A themed selectable chip.
 */
export function Chip({ label, selected, onPress }: ChipProps): ReactElement {
  const handlePress = useCallback(() => {
    onPress();
  }, [onPress]);

  return (
    <Pressable
      onPress={handlePress}
      className={chipVariants({ selected })}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text className={textVariants({ selected })}>{label}</Text>
    </Pressable>
  );
}
