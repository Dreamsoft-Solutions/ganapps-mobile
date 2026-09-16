import { CircleHelp } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Colors } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import { Text } from './Text';

interface FieldHintProps {
  accessibilityLabel: string;
  message: string;
  title: string;
}

/**
 * Renders a tap-to-reveal hint for a form field.
 *
 * @param props - Accessible label and content for the hint.
 * @returns A compact help button with an anchored hint panel.
 */
export function FieldHint({ accessibilityLabel, message, title }: FieldHintProps): ReactElement {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const theme = useResolvedTheme();
  const mutedColor: string = Colors[theme]['muted-foreground'];

  return (
    <View className="relative items-end">
      <Pressable
        onPress={(): void => setIsOpen((previous: boolean): boolean => !previous)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={isOpen ? 'Hides these requirements' : 'Shows these requirements'}
        accessibilityState={{ expanded: isOpen }}
        hitSlop={8}
        className="h-6 w-6 items-center justify-center rounded-full active:bg-accent"
      >
        <CircleHelp size={16} color={mutedColor} />
      </Pressable>

      {isOpen && (
        <View
          className="absolute right-0 top-8 z-20 w-72 rounded-lg border border-border bg-popover p-3 shadow-md"
          accessibilityLiveRegion="polite"
        >
          <Text className="font-inter-semibold text-body-md text-popover-foreground">{title}</Text>
          <Text className="mt-1 text-body-md text-popover-foreground">{message}</Text>
        </View>
      )}
    </View>
  );
}
