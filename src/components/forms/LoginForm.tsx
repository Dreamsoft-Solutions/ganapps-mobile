import { View } from 'react-native';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '@/utils/validation';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { useAuth } from '@/hooks/useAuth';
import type { LoginDto } from '@/types/auth.types';

export function LoginForm() {
  const { login, isLoading } = useAuth();

  const methods = useForm<LoginDto>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginDto) => {
    await login(data);
  };

  return (
    <FormProvider {...methods}>
      <View className="gap-4">
        <Input
          name="email"
          label="Email"
          placeholder="you@example.com"
          keyboardType="email-address"
        />
        <Input
          name="password"
          label="Password"
          placeholder=".........."
          secureTextEntry
        />
        <Button
          onPress={methods.handleSubmit(onSubmit)}
          loading={isLoading}
        >
          Login
        </Button>
      </View>
    </FormProvider>
  );
}
