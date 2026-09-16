import { zodResolver } from '@hookform/resolvers/zod';
import { type ReactElement, useRef, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Input } from '@/components/common/Input';
import { Text } from '@/components/common/Text';
import { ErrorCodes } from '@/constants/errors';
import { useAuth } from '@/hooks/useAuth';
import type { ParsedApiError } from '@/utils/error-handling';
import { type DeleteAccountFormData, deleteAccountSchema } from '@/utils/validation';

function getDeletionErrorMessage(error: ParsedApiError): string {
  if (error.status === 401 || error.errorCode === ErrorCodes.UNAUTHORIZED) {
    return 'Your session expired. Sign in again to request account deletion.';
  }
  if (error.errorCode === ErrorCodes.SUPERADMIN_ACCOUNT_CANNOT_BE_DELETED) {
    return 'This account cannot be deleted.';
  }
  if (error.status === undefined) {
    return "We couldn't confirm account deletion. Check your connection and try again.";
  }
  return error.message;
}

/**
 * Opens the shared two-step account deletion sheet for verified and unverified Users.
 * @returns A destructive entry button and a keyboard-safe confirmation form.
 */
export function DeleteAccountForm(): ReactElement {
  const { deleteAccount, deleteAccountMutation } = useAuth();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<'explain' | 'confirm'>('explain');
  const [error, setError] = useState<ParsedApiError | null>(null);
  const submitting = useRef(false);
  const idempotencyKey = useRef<string | null>(null);
  const methods = useForm<DeleteAccountFormData>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: { confirmationPhrase: '' },
    mode: 'onChange',
  });
  const confirmationPhrase: string = methods.watch('confirmationPhrase');
  const isPending: boolean = methods.formState.isSubmitting || deleteAccountMutation.isPending;
  const isConfirmed: boolean = confirmationPhrase.trim() === 'DELETE MY ACCOUNT';
  const isRefused: boolean = error?.errorCode === ErrorCodes.SUPERADMIN_ACCOUNT_CANNOT_BE_DELETED;

  function resetAttempt(): void {
    methods.reset({ confirmationPhrase: '' });
    setStep('explain');
    setError(null);
    idempotencyKey.current = null;
    deleteAccountMutation.reset();
  }

  function open(): void {
    if (isPending) return;
    resetAttempt();
    setVisible(true);
  }

  function close(): void {
    if (isPending || submitting.current) return;
    setVisible(false);
    resetAttempt();
  }

  async function submit(data: DeleteAccountFormData): Promise<void> {
    if (submitting.current || step !== 'confirm' || isRefused) return;
    submitting.current = true;
    setError(null);
    Keyboard.dismiss();
    idempotencyKey.current ??= `mobile-delete-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    try {
      await deleteAccount({ confirmationPhrase: data.confirmationPhrase, idempotencyKey: idempotencyKey.current });
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught : new Error('Account deletion could not be confirmed.'));
    } finally {
      submitting.current = false;
    }
  }

  return (
    <>
      <Button
        variant="destructive"
        accessibilityHint="Opens confirmation for irreversible account deletion"
        onPress={open}
      >
        Delete account
      </Button>
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
        <SafeAreaView className="flex-1 bg-background">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
            <ScrollView
              className="flex-1"
              contentContainerClassName="grow p-md gap-lg"
              keyboardShouldPersistTaps="handled"
            >
              <Text className="font-inter-semibold text-headline-md" accessibilityRole="header">
                Delete your account?
              </Text>
              {step === 'explain' ? (
                <>
                  <Card>
                    <Text className="text-body-lg">
                      Your account, profile, friendships, event registrations, saved events, and messages will be
                      permanently deactivated or anonymised. Your account cannot be restored.
                    </Text>
                    <Text className="mt-md text-body-lg">Signing out alone does not delete your account.</Text>
                  </Card>
                  <Button onPress={(): void => setStep('confirm')}>Continue</Button>
                </>
              ) : (
                <FormProvider {...methods}>
                  <Text className="text-body-lg">Type DELETE MY ACCOUNT to confirm.</Text>
                  <Input
                    name="confirmationPhrase"
                    label="Confirmation phrase"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isPending}
                  />
                  {error && (
                    <View className="gap-sm">
                      <Text
                        className="text-body-md text-destructive"
                        accessibilityRole="alert"
                        accessibilityLiveRegion="polite"
                      >
                        {getDeletionErrorMessage(error)}
                      </Text>
                      {error.status === undefined && !isRefused && (
                        <Button
                          variant="outline"
                          disabled={!isConfirmed || isPending}
                          onPress={methods.handleSubmit(submit)}
                        >
                          Try again
                        </Button>
                      )}
                    </View>
                  )}
                  <Button
                    variant="destructive"
                    accessibilityHint="Permanently deactivates and anonymises your account"
                    disabled={!isConfirmed || isPending || isRefused}
                    loading={isPending}
                    onPress={methods.handleSubmit(submit)}
                  >
                    Delete account permanently
                  </Button>
                </FormProvider>
              )}
              <Button variant="outline" disabled={isPending} onPress={close}>
                Cancel
              </Button>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </>
  );
}
