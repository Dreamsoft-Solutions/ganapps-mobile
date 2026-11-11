import { ArrowLeft } from 'lucide-react-native';
import type { ReactElement, ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '@/components/common/IconButton';
import { Text } from '@/components/common/Text';
import { Spacing } from '@/constants/theme';

interface ScreenHeaderProps {
  /** The screen's title. Omit it for a header that only holds the back button. */
  title?: string;
  /** A muted line under the title, such as the event a form belongs to. */
  subtitle?: string;
  /** Shows the back button when set. */
  onBack?: () => void;
  /** Says where the back button goes, for screen readers. */
  backHint?: string;
  /** Actions on the right, such as a settings button. */
  right?: ReactNode;
  /** Draws a hairline under the header, for screens whose content scrolls beneath it. */
  bordered?: boolean;
}

/**
 * The header every screen that draws its own uses: an optional back button, the title, and
 * optional actions on the right.
 *
 * It owns the top safe-area inset plus 16dp, so the title sits at the same height on every
 * screen. The back button is the filled `IconButton` with `ArrowLeft` at 20, the same one
 * Event details floats over its photo. The row is at least 48dp tall, so a title lines up
 * whether or not the header has buttons.
 *
 * @param props - Title, subtitle, back handler, right-hand actions, and border.
 * @returns The header row.
 */
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  backHint,
  right,
  bordered = false,
}: ScreenHeaderProps): ReactElement {
  const insets = useSafeAreaInsets();
  return (
    <View
      className={`bg-background px-md pb-sm ${bordered ? 'border-b border-border' : ''}`}
      style={{ paddingTop: insets.top + Spacing.md }}
    >
      <View className="min-h-touch flex-row items-center gap-sm">
        {onBack ? (
          <IconButton variant="default" accessibilityLabel="Go back" accessibilityHint={backHint} onPress={onBack}>
            <ArrowLeft size={20} />
          </IconButton>
        ) : null}
        <View className="min-w-0 flex-1">
          {title ? (
            <Text className="font-inter-bold text-headline-md" numberOfLines={1} accessibilityRole="header">
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text className="text-body-md text-muted-foreground" numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right}
      </View>
    </View>
  );
}
