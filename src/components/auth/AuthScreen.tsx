import { ArrowLeft } from 'lucide-react-native';
import type { ReactElement, ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '@/components/common/IconButton';
import { Lobe } from '@/components/common/Lobe';
import { Text } from '@/components/common/Text';
import { Spacing } from '@/constants/theme';

/** Props for {@link AuthScreen}. */
export interface AuthScreenProps {
  /** The screen title, set in `headline-lg` bold. */
  title: string;
  /** One line under the title. */
  subtitle?: ReactNode;
  /** Shows the back button when set. */
  onBack?: () => void;
  /** Says where the back button goes, for screen readers. */
  backHint?: string;
  /** Content on the right of the header row, such as a step marker. */
  headerRight?: ReactNode;
  /** The form. It scrolls, and the focused field stays above the keyboard. */
  children: ReactNode;
  /** Actions pinned under the scroll area, above the keyboard and the home indicator. */
  footer?: ReactNode;
}

/**
 * The frame every sign-in screen shares (log in, sign up, password reset, email verification and
 * profile setup), so the flow reads as Welcome continued: the `background` ground with Welcome's
 * top-right `Lobe`, the back button `ScreenHeader` uses, then a top-aligned `headline-lg` title
 * and one line under it. The form itself is solid; nothing here is glass.
 *
 * The header row is always 48dp tall, with or without a back button, so the title sits at the same
 * height on every screen. The scroll area and the optional `footer` move up with the keyboard.
 *
 * @param props - Title, subtitle, back handler, header accessory, form and pinned footer.
 * @returns The framed screen.
 * @example
 * <AuthScreen title="Welcome back" subtitle="Log in to see what's on across Iloilo." onBack={router.back}>
 *   <LoginForm />
 * </AuthScreen>
 */
export function AuthScreen({
  title,
  subtitle,
  onBack,
  backHint,
  headerRight,
  children,
  footer,
}: AuthScreenProps): ReactElement {
  const insets = useSafeAreaInsets();
  const bottomPad: number = insets.bottom + Spacing.md;

  return (
    <View className="flex-1 overflow-hidden bg-background">
      <Lobe size={460} top={-250} right={-230} opacity={0.9} />

      <View className="min-h-touch flex-row items-center px-md" style={{ marginTop: insets.top + Spacing.md }}>
        {onBack ? (
          <IconButton variant="default" accessibilityLabel="Go back" accessibilityHint={backHint} onPress={onBack}>
            <ArrowLeft size={20} />
          </IconButton>
        ) : null}
        <View className="flex-1" />
        {headerRight}
      </View>

      <KeyboardAvoidingView className="flex-1" behavior="padding">
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-lg pt-lg"
          contentContainerStyle={footer ? undefined : { paddingBottom: bottomPad }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-xl gap-xs">
            <Text className="font-allo-bold text-headline-lg text-foreground" accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? <Text className="text-body-md text-muted-foreground">{subtitle}</Text> : null}
          </View>
          {children}
        </ScrollView>

        {footer ? (
          <View className="gap-sm px-lg pt-sm" style={{ paddingBottom: bottomPad }}>
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}
