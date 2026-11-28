import { cva, type VariantProps } from 'class-variance-authority';
import { LucideProvider } from 'lucide-react-native';
import { type ReactElement, type ReactNode, useCallback } from 'react';
import { Colors } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import { Capsule } from './Capsule';
import { Glass } from './Glass';
import { PressableScale, type PressableScaleState } from './PressableScale';
import { Text } from './Text';

/** Layout classes for a {@link Chip}. Colour, radius and the rim come from `Glass` and `Capsule`. */
export const chipVariants = cva('flex-row items-center gap-1 border border-transparent px-4 py-2', {
  variants: {
    selected: {
      true: '',
      false: '',
    },
  },
  defaultVariants: {
    selected: false,
  },
});

/** Label classes for a {@link Chip}, exported alongside {@link chipVariants}. */
export const chipTextVariants = cva('text-body-md font-allo-semibold', {
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

const CHIP_ICON_SIZE = 16;

/** Props for {@link Chip}. */
interface ChipProps extends VariantProps<typeof chipVariants> {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Icon drawn before the label, 16px, in the label colour. */
  icon?: ReactNode;
  /** Dims the chip and blocks presses. */
  disabled?: boolean;
  /** Spoken label. Defaults to the visible label. */
  accessibilityLabel?: string;
  /** `'switch'` announces a toggle with a checked state. Defaults to `'button'`. */
  role?: 'button' | 'switch';
}

/**
 * Selectable chip for interests, filters, or tags. Unselected it is a strong Glass pill; selected it is a
 * primary Capsule.
 *
 * @param props - Label, selection state, press handler, and optional icon, disabled state and role.
 * @returns A themed selectable chip.
 * @example
 * <Chip label="Nearby" icon={<MapPin />} role="switch" selected={isNearby} onPress={toggleNearby} />
 */
export function Chip({
  label,
  selected,
  onPress,
  icon,
  disabled = false,
  accessibilityLabel,
  role = 'button',
}: ChipProps): ReactElement {
  const theme = useResolvedTheme();
  const handlePress = useCallback(() => {
    onPress();
  }, [onPress]);

  const labelColor: string = selected ? Colors[theme]['primary-foreground'] : Colors[theme].foreground;
  const classes: string = chipVariants({ selected });
  const content: ReactElement = (
    <>
      {icon ? (
        <LucideProvider color={labelColor} size={CHIP_ICON_SIZE}>
          {icon}
        </LucideProvider>
      ) : null}
      <Text className={chipTextVariants({ selected })}>{label}</Text>
    </>
  );

  return (
    <PressableScale
      onPress={handlePress}
      disabled={disabled}
      className={disabled ? 'opacity-50' : undefined}
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={role === 'switch' ? { checked: selected, disabled } : { selected, disabled }}
    >
      {({ pressed }: PressableScaleState): ReactElement =>
        selected ? (
          <Capsule tone="primary" glow={false} pressed={pressed} className={classes}>
            {content}
          </Capsule>
        ) : (
          <Glass variant="strong" rim="sm" pressed={pressed} className={classes}>
            {content}
          </Glass>
        )
      }
    </PressableScale>
  );
}
