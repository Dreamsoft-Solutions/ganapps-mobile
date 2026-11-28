import { zodResolver } from '@hookform/resolvers/zod';
import type { ReactElement } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { useAuth } from '@/hooks/useAuth';
import type { VerifyEmailFormData } from '@/utils/validation';
import { verifyEmailSchema } from '@/utils/validation';

/**
 * Form for submitting the email verification code: one large, centred one-time-code field that
 * the keyboard's suggestion strip can fill, and the Verify email action. A rejected code is shown
 * on the field itself, not as a toast, so the person sees it where they will fix it.
 *
 * @returns The verification code form.
 * @example
 * <VerifyEmailForm />
 */
export function VerifyEmailForm(): ReactElement {
  const { verifyEmail, verifyEmailMutation } = useAuth();

  const methods = useForm<VerifyEmailFormData>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: { code: '' },
  });

  const onSubmit = async (data: VerifyEmailFormData): Promise<void> => {
    try {
      await verifyEmail({ code: data.code });
    } catch (caught: unknown) {
      const message: string = caught instanceof Error ? caught.message : 'That code did not work. Try again.';
      methods.setError('code', { message }, { shouldFocus: true });
    }
  };

  const submit = methods.handleSubmit(onSubmit);

  return (
    <FormProvider {...methods}>
      <View>
        <Input
          name="code"
          label="Verification code"
          placeholder="000000"
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          variant="code"
          maxLength={6}
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        <View className="mt-xs">
          <Button onPress={submit} loading={verifyEmailMutation.isPending} size="auth">
            Verify email
          </Button>
        </View>
      </View>
    </FormProvider>
  );
}
