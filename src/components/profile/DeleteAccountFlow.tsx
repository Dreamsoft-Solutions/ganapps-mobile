import type { ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Text } from '@/components/common/Text';
import { ErrorCodes } from '@/constants/errors';
import { Colors } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';

/** The case-sensitive phrase required by the account-deletion API. */
export const ACCOUNT_DELETION_CONFIRMATION_PHRASE = 'DELETE MY ACCOUNT';

type DeleteAccountStep = 'warning' | 'confirmation';

export interface DeleteAccountFlowProps {
  /** Whether the confirmation sheet is mounted and visible. */
  readonly visible: boolean;
  /** Whether the online deletion request is currently in flight. */
  readonly isDeleting: boolean;
  /** The latest typed API or transport error, if any. */
  readonly error: Error | null;
  /** Closes the flow without changing the account. */
  readonly onClose: () => void;
  /** Submits the exact confirmation phrase to the aggregate auth action. */
  readonly onDelete: (confirmationPhrase: string) => Promise<void>;
}

/**
 * Two-step, keyboard-safe account-deletion confirmation sheet.
 *
 * The component owns only disclosure and confirmation form state. Cache clearing,
 * token removal, navigation, and idempotency are handled by the aggregate auth action.
 *
 * @param props - Visibility, mutation state, error state, and flow callbacks.
 * @returns A native bottom-sheet modal while visible, or null while closed.
 */
export function DeleteAccountFlow({
  visible,
  isDeleting,
  error,
  onClose,
  onDelete,
}: DeleteAccountFlowProps): ReactElement | null {
  const insets = useSafeAreaInsets();
  const theme = useResolvedTheme();
  const [step, setStep] = useState<DeleteAccountStep>('warning');
  const [confirmationPhrase, setConfirmationPhrase] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const submissionInFlight = useRef<boolean>(false);
  const wasVisible = useRef<boolean>(visible);
  const isExactPhrase: boolean = confirmationPhrase.trim() === ACCOUNT_DELETION_CONFIRMATION_PHRASE;
  const errorMessage: string | null = getDeleteAccountErrorMessage(error);
  const isBusy: boolean = isDeleting || isSubmitting;

  useEffect((): void => {
    if (visible && !wasVisible.current) {
      setStep('warning');
      setConfirmationPhrase('');
      setIsSubmitting(false);
    }
    wasVisible.current = visible;
  }, [visible]);

  const closeFlow = (): void => {
    if (!isBusy) onClose();
  };

  const continueToConfirmation = (): void => {
    if (!isBusy) setStep('confirmation');
  };

  const submitDeletion = async (): Promise<void> => {
    if (!isExactPhrase || isBusy || submissionInFlight.current) return;

    submissionInFlight.current = true;
    setIsSubmitting(true);
    try {
      await onDelete(confirmationPhrase.trim());
    } finally {
      submissionInFlight.current = false;
      setIsSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={closeFlow}>
      <View className="flex-1 justify-end">
        <View
          testID="delete-account-scrim"
          className="absolute inset-0"
          style={{ backgroundColor: Colors[theme].foreground, opacity: 0.4 }}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="max-h-[92%]"
          testID="delete-account-keyboard-view"
        >
          <View
            testID="delete-account-sheet"
            className="rounded-t-3xl bg-background px-md pt-md"
            style={{ paddingBottom: insets.bottom + 16 }}
            accessibilityViewIsModal
          >
            <ScrollView
              testID="delete-account-scroll"
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 8 }}
            >
              <View className="mb-md flex-row items-center justify-between">
                <Text accessibilityRole="header" className="text-headline-md">
                  Delete your account?
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close account deletion"
                  accessibilityHint="Closes the account deletion confirmation"
                  onPress={closeFlow}
                  disabled={isBusy}
                  className="rounded-md px-2 py-1 active:bg-muted"
                >
                  <Text className="text-body-md text-muted-foreground">Close</Text>
                </Pressable>
              </View>

              {step === 'warning' ? (
                <WarningStep isDeleting={isBusy} onClose={closeFlow} onContinue={continueToConfirmation} />
              ) : (
                <ConfirmationStep
                  confirmationPhrase={confirmationPhrase}
                  errorMessage={errorMessage}
                  isDeleting={isBusy}
                  isExactPhrase={isExactPhrase}
                  onChangePhrase={setConfirmationPhrase}
                  onClose={closeFlow}
                  onDelete={submitDeletion}
                />
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

interface WarningStepProps {
  readonly isDeleting: boolean;
  readonly onClose: () => void;
  readonly onContinue: () => void;
}

function WarningStep({ isDeleting, onClose, onContinue }: WarningStepProps): ReactElement {
  return (
    <>
      <Card className="mb-md">
        <Text className="text-body-md">
          Deleting your account permanently deactivates it and anonymises your profile, friendships, registrations,
          saved Ganaps, and messages. This cannot be undone or restored.
        </Text>
        <Text className="text-body-md text-muted-foreground mt-md">
          Signing out alone does not delete your account.
        </Text>
      </Card>
      <View className="gap-sm">
        <Button
          accessibilityHint="Continues to the irreversible account deletion confirmation"
          onPress={onContinue}
          disabled={isDeleting}
          variant="destructive"
        >
          Continue
        </Button>
        <Button onPress={onClose} disabled={isDeleting} variant="outline">
          Cancel
        </Button>
      </View>
    </>
  );
}

interface ConfirmationStepProps {
  readonly confirmationPhrase: string;
  readonly errorMessage: string | null;
  readonly isDeleting: boolean;
  readonly isExactPhrase: boolean;
  readonly onChangePhrase: (value: string) => void;
  readonly onClose: () => void;
  readonly onDelete: () => Promise<void>;
}

function ConfirmationStep({
  confirmationPhrase,
  errorMessage,
  isDeleting,
  isExactPhrase,
  onChangePhrase,
  onClose,
  onDelete,
}: ConfirmationStepProps): ReactElement {
  const theme = useResolvedTheme();
  const hasMismatch: boolean = confirmationPhrase.length > 0 && !isExactPhrase;

  return (
    <>
      <Text className="text-body-md mb-md">Type DELETE MY ACCOUNT to confirm.</Text>
      <Text className="text-label-md mb-xs" nativeID="delete-account-confirmation-label">
        Confirmation phrase
      </Text>
      <TextInput
        testID="delete-account-confirmation-input"
        accessibilityLabel="Confirmation phrase"
        accessibilityHint="Type DELETE MY ACCOUNT exactly to enable account deletion"
        aria-label="Confirmation phrase"
        aria-labelledby="delete-account-confirmation-label"
        value={confirmationPhrase}
        onChangeText={onChangePhrase}
        placeholder={ACCOUNT_DELETION_CONFIRMATION_PHRASE}
        placeholderTextColor={Colors[theme]['muted-foreground']}
        autoCapitalize="characters"
        autoCorrect={false}
        editable={!isDeleting}
        maxLength={ACCOUNT_DELETION_CONFIRMATION_PHRASE.length + 16}
        className="mb-xs rounded-lg border border-input bg-background px-4 py-3 text-body-md text-foreground"
      />
      {hasMismatch && (
        <Text accessibilityLiveRegion="polite" className="text-body-md text-destructive mb-sm">
          Enter the exact phrase DELETE MY ACCOUNT to continue.
        </Text>
      )}
      {errorMessage !== null && (
        <Text accessibilityLiveRegion="polite" className="text-body-md text-destructive mb-sm">
          {errorMessage}
        </Text>
      )}
      <View className="gap-sm">
        <Button
          accessibilityHint="Permanently deactivates and anonymises your account"
          onPress={onDelete}
          disabled={!isExactPhrase}
          loading={isDeleting}
          variant="destructive"
        >
          Delete account permanently
        </Button>
        <Button onPress={onClose} disabled={isDeleting} variant="outline">
          Cancel
        </Button>
      </View>
    </>
  );
}

/**
 * Maps the typed server code to deletion-specific copy without inspecting error text.
 *
 * @param error - Mutation error from the normalized API layer.
 * @returns Safe inline copy, or null when no error exists.
 */
function getDeleteAccountErrorMessage(error: Error | null): string | null {
  if (error === null) return null;

  const errorCode: string | undefined = readErrorCode(error);
  if (errorCode === ErrorCodes.NETWORK_ERROR) {
    return "We couldn't confirm account deletion. Check your connection and try again.";
  }

  if (
    errorCode === ErrorCodes.UNAUTHORIZED ||
    errorCode === ErrorCodes.REFRESH_TOKEN_EXPIRED ||
    errorCode === ErrorCodes.REFRESH_TOKEN_REVOKED ||
    errorCode === ErrorCodes.TOKEN_THEFT_DETECTED
  ) {
    return 'Your session expired. Sign in again to request account deletion.';
  }

  if (errorCode === ErrorCodes.SUPERADMIN_ACCOUNT_CANNOT_BE_DELETED) {
    return 'This account cannot be deleted.';
  }

  return error.message.trim() || "We couldn't delete your account. Please try again.";
}

function readErrorCode(error: Error): string | undefined {
  const candidate: unknown = (error as Error & { errorCode?: unknown }).errorCode;
  return typeof candidate === 'string' ? candidate : undefined;
}
