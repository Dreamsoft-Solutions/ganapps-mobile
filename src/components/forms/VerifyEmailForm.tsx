import { zodResolver } from '@hookform/resolvers/zod';
import type { ReactElement } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { useAuth } from '@/hooks/useAuth';
import type { VerifyEmailFormData } from '@/utils/validation';
import { verifyEmailSchema } from '@/utils/validation';

export function VerifyEmailForm(): ReactElement {
  const { verifyEmail, verifyEmailMutation } = useAuth();

  const methods = useForm<VerifyEmailFormData>({
    resolver: zodResolver(verifyEmailSchema),
  });

  const onSubmit = async (data: VerifyEmailFormData): Promise<void> => {
    await verifyEmail({ code: data.code });
  };

  return (
    <FormProvider {...methods}>
      <View className="gap-4">
        <Input name="code" label="Verification Code" placeholder="000000" keyboardType="number-pad" />
        <Button onPress={methods.handleSubmit(onSubmit)} loading={verifyEmailMutation.isPending}>
          Verify Email
        </Button>
      </View>
    </FormProvider>
  );
}
