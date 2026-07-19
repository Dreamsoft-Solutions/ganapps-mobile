import { View } from 'react-native';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { onboardingSchema } from '@/utils/validation';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { useAuth } from '@/hooks/useAuth';
import type { OnboardingFormData } from '@/utils/validation';

export function OnboardingForm() {
  const { updateProfile, updateProfileMutation } = useAuth();

  const methods = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
  });

  const onSubmit = async (data: OnboardingFormData) => {
    await updateProfile({
      firstName: data.firstName || undefined,
      lastName: data.lastName || undefined,
      interests: data.interests,
    });
  };

  return (
    <FormProvider {...methods}>
      <View className="gap-4">
        <Input
          name="firstName"
          label="First Name"
          placeholder="John"
        />
        <Input
          name="lastName"
          label="Last Name"
          placeholder="Doe"
        />
        <Button
          onPress={methods.handleSubmit(onSubmit)}
          loading={updateProfileMutation.isPending}
        >
          Finish Setup
        </Button>
      </View>
    </FormProvider>
  );
}
