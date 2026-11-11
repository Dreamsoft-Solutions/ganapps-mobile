import { X } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';
import { Text } from '@/components/common/Text';
import { Colors, Spacing } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import { showToast } from '@/store/toast.store';
import type { GanapReportReason, GanapReportReceipt, ReportGanapInput } from '@/types/ganap.types';
import {
  buildGanapReportInput,
  GANAP_REPORT_REASONS,
  getGanapReportErrorMessage,
  limitGanapReportDetails,
  MAX_GANAP_REPORT_DETAILS_LENGTH,
} from '@/utils/ganap-report';

/** Props for the Ganap report sheet. */
export interface GanapReportSheetProps {
  visible: boolean;
  /** Title of the reported Ganap, shown so the User knows what they are reporting. */
  ganapTitle: string;
  onClose: () => void;
  /** Sends the report; a rejection is rendered inline and keeps the sheet open. */
  onSubmit: (input: ReportGanapInput) => Promise<GanapReportReceipt>;
}

/**
 * Lets a User report a Ganap with one reason and optional details.
 *
 * The sheet resets each time it opens, keeps details local until submit, and
 * shows failures inline so a duplicate or rate-limited report is explained
 * without losing what the User typed.
 *
 * @param props - Visibility, the Ganap title, and the close and submit callbacks
 * @returns A safe-area-aware, keyboard-safe report sheet, or null while hidden
 */
export function GanapReportSheet({
  visible,
  ganapTitle,
  onClose,
  onSubmit,
}: GanapReportSheetProps): ReactElement | null {
  const insets = useSafeAreaInsets();
  const theme = useResolvedTheme();
  const [reason, setReason] = useState<GanapReportReason | null>(null);
  const [details, setDetails] = useState<string>('');
  const [error, setError] = useState<Error | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect((): void => {
    if (!visible) return;
    setReason(null);
    setDetails('');
    setError(null);
    setIsSubmitting(false);
  }, [visible]);

  if (!visible) return null;

  const close = (): void => {
    if (isSubmitting) return;
    onClose();
  };

  const submit = async (): Promise<void> => {
    if (!reason || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit(buildGanapReportInput(reason, details));
      showToast('success', "Report received. We'll review it.");
      onClose();
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError : new Error('Unable to submit report.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close} accessibilityViewIsModal>
      <View className="flex-1 justify-end bg-black/40">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? Spacing.md : 0}
          className="max-h-[92%] rounded-t-xl bg-popover"
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: Spacing.md, paddingBottom: insets.bottom + Spacing.md }}
          >
            <View className="mb-md flex-row items-center justify-between">
              <Text className="flex-1 font-inter-bold text-headline-sm" accessibilityRole="header">
                Report this event
              </Text>
              <IconButton accessibilityLabel="Close report" onPress={close} disabled={isSubmitting}>
                <X size={20} color={Colors[theme].foreground} />
              </IconButton>
            </View>
            <Text className="mb-xs text-body-md text-muted-foreground" numberOfLines={2}>
              {ganapTitle}
            </Text>
            <Text className="mb-md text-body-md text-muted-foreground">
              Choose a reason. The Ganapps team will review your report.
            </Text>
            <View accessibilityRole="radiogroup">
              {GANAP_REPORT_REASONS.map(
                ({ value, label }): ReactElement => (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityLabel={label}
                    accessibilityState={{ selected: reason === value }}
                    disabled={isSubmitting}
                    onPress={(): void => setReason(value)}
                    className={`mb-sm min-h-touch justify-center rounded-lg border px-md py-sm ${reason === value ? 'border-primary bg-muted' : 'border-border bg-background'}`}
                  >
                    <Text className="text-body-md">{label}</Text>
                  </Pressable>
                ),
              )}
            </View>
            <View className="mb-md">
              <Text nativeID="ganap-report-details-label" className="mb-xs font-inter-semibold text-label-md">
                Details (optional)
              </Text>
              <TextInput
                accessibilityLabel="Details (optional)"
                aria-labelledby="ganap-report-details-label"
                multiline
                editable={!isSubmitting}
                maxLength={MAX_GANAP_REPORT_DETAILS_LENGTH}
                value={details}
                onChangeText={(value: string): void => setDetails(limitGanapReportDetails(value))}
                placeholder="What's wrong with this event?"
                placeholderTextColor={Colors[theme]['muted-foreground']}
                textAlignVertical="top"
                className="min-h-24 rounded-lg border border-input bg-background px-md py-sm text-body-md text-foreground"
              />
              <Text className="mt-xs text-right text-label-sm text-muted-foreground">
                {Array.from(details).length}/{MAX_GANAP_REPORT_DETAILS_LENGTH.toLocaleString()}
              </Text>
            </View>
            {error && (
              <View className="mb-md rounded-lg border border-destructive bg-background p-sm">
                <Text accessibilityLiveRegion="polite" className="text-body-md text-destructive">
                  {getGanapReportErrorMessage(error)}
                </Text>
              </View>
            )}
            <Button
              disabled={!reason || isSubmitting}
              loading={isSubmitting}
              accessibilityHint="Sends this report to the Ganapps team for review"
              onPress={submit}
            >
              Submit report
            </Button>
            <View className="mt-sm">
              <Button variant="outline" disabled={isSubmitting} onPress={close}>
                Cancel
              </Button>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
