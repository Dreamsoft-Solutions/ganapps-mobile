import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Text } from '@/components/common/Text';
import { PasswordVisibilityToggle } from '@/components/forms/PasswordVisibilityToggle';
import { Routes } from '@/constants/routes';
import { useAuth } from '@/hooks/useAuth';
import type { CompletePasswordResetFormData, RequestPasswordResetFormData } from '@/utils/validation';
import { completePasswordResetSchema, requestPasswordResetSchema } from '@/utils/validation';

/** The three steps of a password reset. */
export type PasswordResetStep = 'request' | 'complete' | 'success';

interface PasswordResetFormProps {
  initialEmail: string;
  /**
   * Called when the step changes, with the server's confirmation message once there is one, so
   * the screen can set the line under its title. The form draws no intro copy of its own.
   */
  onStepChange?: (step: PasswordResetStep, message: string) => void;
}

/**
 * Guides a User through requesting and consuming an email password-reset code, inside `AuthScreen`
 * (whose subtitle explains the request step). Fields carry autofill hints, the reset code is a
 * one-time-code field, and the keyboard's next key moves from code to new password to confirm.
 *
 * @param props - Optional email value carried from the login screen.
 * @returns The request, code-entry, or completion state of password recovery.
 */
export function PasswordResetForm({ initialEmail, onStepChange }: PasswordResetFormProps): ReactElement {
  const router = useRouter();
  const { requestPasswordReset, completePasswordReset, requestPasswordResetMutation, completePasswordResetMutation } =
    useAuth();
  const [step, setStep] = useState<PasswordResetStep>('request');
  const [email, setEmail] = useState(initialEmail);
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);

  useEffect((): void => {
    onStepChange?.(step, confirmationMessage);
  }, [step, confirmationMessage, onStepChange]);

  const requestMethods = useForm<RequestPasswordResetFormData>({
    resolver: zodResolver(requestPasswordResetSchema),
    defaultValues: { email: initialEmail },
    mode: 'onTouched',
  });
  const completeMethods = useForm<CompletePasswordResetFormData>({
    resolver: zodResolver(completePasswordResetSchema),
    defaultValues: { code: '', password: '', confirmPassword: '' },
    mode: 'onTouched',
  });

  const handleRequest = useCallback(
    async (values: RequestPasswordResetFormData): Promise<void> => {
      try {
        const result = await requestPasswordReset(values);
        setEmail(values.email);
        requestPasswordResetMutation.reset();
        setStep('complete');
        setConfirmationMessage(result.message);
      } catch {}
    },
    [requestPasswordReset, requestPasswordResetMutation],
  );

  const handleComplete = useCallback(
    async (values: CompletePasswordResetFormData): Promise<void> => {
      try {
        const result = await completePasswordReset({
          email,
          code: values.code,
          password: values.password,
        });
        setConfirmationMessage(result.message);
        setStep('success');
      } catch {}
    },
    [completePasswordReset, email],
  );

  const requestError = requestPasswordResetMutation.error?.message;
  const completeError = completePasswordResetMutation.error?.message;

  if (step === 'success') {
    return (
      <View>
        <Button onPress={(): void => router.replace(Routes.auth.login)} size="auth">
          Back to log in
        </Button>
      </View>
    );
  }

  if (step === 'complete') {
    return (
      <FormProvider key="complete" {...completeMethods}>
        <View>
          <Input
            name="code"
            label="Reset code"
            placeholder="00000000"
            keyboardType="number-pad"
            autoCapitalize="none"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            variant="code"
            returnKeyType="next"
            onSubmitEditing={(): void => completeMethods.setFocus('password')}
            maxLength={8}
          />
          <Input
            name="password"
            label="New password"
            placeholder="8-128 characters"
            secureTextEntry={!showPassword}
            iconRight={
              <PasswordVisibilityToggle
                visible={showPassword}
                onPress={(): void => setShowPassword((previous: boolean): boolean => !previous)}
                label="new password"
              />
            }
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="next"
            onSubmitEditing={(): void => completeMethods.setFocus('confirmPassword')}
            maxLength={128}
          />
          <Input
            name="confirmPassword"
            label="Confirm new password"
            secureTextEntry={!showConfirmPassword}
            iconRight={
              <PasswordVisibilityToggle
                visible={showConfirmPassword}
                onPress={(): void => setShowConfirmPassword((previous: boolean): boolean => !previous)}
                label="confirm new password"
              />
            }
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={completeMethods.handleSubmit(handleComplete)}
            maxLength={128}
          />
          <Text className="-mt-xs mb-lg text-label-sm text-muted-foreground">
            Use 8–128 characters with an uppercase letter, lowercase letter, number, and punctuation mark.
          </Text>
          {completeError && (
            <Text className="mb-sm text-center text-body-md text-destructive" accessibilityRole="alert">
              {completeError}
            </Text>
          )}
          <Button
            onPress={completeMethods.handleSubmit(handleComplete)}
            loading={completePasswordResetMutation.isPending}
            size="auth"
          >
            Reset password
          </Button>
          <View className="mt-lg items-center">
            <Text className="text-center text-body-md text-muted-foreground">
              Didn’t receive the code? Check your spam folder.
            </Text>
            <Button
              variant="link"
              onPress={(): void => {
                completePasswordResetMutation.reset();
                requestPasswordResetMutation.reset();
                requestMethods.setValue('email', email);
                setStep('request');
              }}
            >
              Resend code or change email
            </Button>
          </View>
        </View>
      </FormProvider>
    );
  }

  return (
    <FormProvider key="request" {...requestMethods}>
      <View>
        <Input
          name="email"
          label="Email"
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="send"
          onSubmitEditing={requestMethods.handleSubmit(handleRequest)}
        />
        {requestError && (
          <Text className="mb-sm text-center text-body-md text-destructive" accessibilityRole="alert">
            {requestError}
          </Text>
        )}
        <Button
          onPress={requestMethods.handleSubmit(handleRequest)}
          loading={requestPasswordResetMutation.isPending}
          size="auth"
        >
          Send reset code
        </Button>
      </View>
    </FormProvider>
  );
}
