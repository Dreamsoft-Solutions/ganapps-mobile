import { View } from 'react-native';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterFormData } from '@/utils/validation';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { useAuth } from '@/hooks/useAuth';
import type { RegisterDto } from '@/types/auth.types';

export function RegisterForm() {
  const { register, isLoading } = useAuth();

  const methods = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    const dto: RegisterDto = {
      email: data.email,
      password: data.password,
      username: data.username,
    };
    await register(dto);
  };

  return (
    <FormProvider {...methods}>
      <View className="gap-4">
        <Input
          name="username"
          label="Username"
          placeholder="johndoe"
        />
        <Input
          name="email"
          label="Email"
          placeholder="you@example.com"
          keyboardType="email-address"
        />
        <Input
          name="password"
          label="Password"
          placeholder="Min. 8 characters"
          secureTextEntry
        />
        <Input
          name="confirmPassword"
          label="Confirm Password"
          placeholder="Re-enter your password"
          secureTextEntry
        />
        <Button
          onPress={methods.handleSubmit(onSubmit)}
          loading={isLoading}
        >
          Create Account
        </Button>
      </View>
    </FormProvider>
  );
}
