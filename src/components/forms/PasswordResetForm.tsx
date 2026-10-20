import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useCallback, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Text } from '@/components/common/Text';
import { Routes } from '@/constants/routes';
import { useAuth } from '@/hooks/useAuth';
import type { CompletePasswordResetFormData, RequestPasswordResetFormData } from '@/utils/validation';
import { completePasswordResetSchema, requestPasswordResetSchema } from '@/utils/validation';

interface PasswordResetFormProps {
  initialEmail: string;
}

/**
 * Guides a User through requesting and consuming an email password-reset code.
 *
 * @param props - Optional email value carried from the login screen.
 * @returns The request, code-entry, or completion state of password recovery.
 */
export function PasswordResetForm({ initialEmail }: PasswordResetFormProps): ReactElement {
  const router = useRouter();
  const { requestPasswordReset, completePasswordReset, requestPasswordResetMutation, completePasswordResetMutation } =
    useAuth();
  const [step, setStep] = useState<'request' | 'complete' | 'success'>('request');
  const [email, setEmail] = useState(initialEmail);
  const [confirmationMessage, setConfirmationMessage] = useState('');

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
      <View className="gap-4">
        <Text className="text-body-md text-foreground text-center" accessibilityRole="alert">
          {confirmationMessage}
        </Text>
        <Button onPress={(): void => router.replace(Routes.auth.login)} size="lg">
          Back to Log In
        </Button>
      </View>
    );
  }

  if (step === 'complete') {
    return (
      <FormProvider key="complete" {...completeMethods}>
        <View>
          <Text className="text-body-md text-muted-foreground text-center mb-4">
            {confirmationMessage} Enter the 8-digit code below and choose a new password.
          </Text>
          <Input
            name="code"
            label="Reset code"
            placeholder="8-digit code"
            keyboardType="number-pad"
            autoCapitalize="none"
            maxLength={8}
          />
          <Input
            name="password"
            label="New password"
            placeholder="8-128 characters"
            secureTextEntry
            autoCapitalize="none"
            maxLength={128}
          />
          <Input
            name="confirmPassword"
            label="Confirm new password"
            placeholder="Re-enter your password"
            secureTextEntry
            autoCapitalize="none"
            maxLength={128}
          />
          <Text className="text-label-sm text-muted-foreground mb-4">
            Use 8–128 characters with an uppercase letter, lowercase letter, number, and punctuation mark.
          </Text>
          {completeError && (
            <Text className="text-body-md text-destructive text-center mb-4" accessibilityRole="alert">
              {completeError}
            </Text>
          )}
          <Button
            onPress={completeMethods.handleSubmit(handleComplete)}
            loading={completePasswordResetMutation.isPending}
            size="lg"
          >
            Reset Password
          </Button>
          <View className="mt-3 items-center">
            <Text className="text-body-md text-muted-foreground mb-2">
              Didn’t receive the code? Check your spam folder.
            </Text>
            <Button
              variant="link"
              size="sm"
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
        <Text className="text-body-md text-muted-foreground text-center mb-4">
          Enter your email and we’ll send a code if an account matches.
        </Text>
        <Input
          name="email"
          label="Email"
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {requestError && (
          <Text className="text-body-md text-destructive text-center mb-4" accessibilityRole="alert">
            {requestError}
          </Text>
        )}
        <Button
          onPress={requestMethods.handleSubmit(handleRequest)}
          loading={requestPasswordResetMutation.isPending}
          size="lg"
        >
          Send Reset Code
        </Button>
      </View>
    </FormProvider>
  );
}
