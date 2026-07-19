import { View } from 'react-native';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { verifyEmailSchema } from '@/utils/validation';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { useAuth } from '@/hooks/useAuth';
import type { VerifyEmailFormData } from '@/utils/validation';

export function VerifyEmailForm() {
  const { verifyEmail, verifyEmailMutation } = useAuth();

  const methods = useForm<VerifyEmailFormData>({
    resolver: zodResolver(verifyEmailSchema),
  });

  const onSubmit = async (data: VerifyEmailFormData) => {
    await verifyEmail({ code: data.code });
  };

  return (
    <FormProvider {...methods}>
      <View className="gap-4">
        <Input
          name="code"
          label="Verification Code"
          placeholder="000000"
          keyboardType="number-pad"
        />
        <Button
          onPress={methods.handleSubmit(onSubmit)}
          loading={verifyEmailMutation.isPending}
        >
          Verify Email
        </Button>
      </View>
    </FormProvider>
  );
}
