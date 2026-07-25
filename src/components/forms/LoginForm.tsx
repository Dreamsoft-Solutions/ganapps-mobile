import { zodResolver } from '@hookform/resolvers/zod';
import { FormProvider, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Text } from '@/components/common/Text';
import { useAuth } from '@/hooks/useAuth';
import type { LoginDto } from '@/types/auth.types';
import { loginSchema } from '@/utils/validation';

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
        <Input name="email" label="Email" placeholder="you@example.com" keyboardType="email-address" />
        <Input name="password" label="Password" placeholder=".........." secureTextEntry />
        <Button onPress={methods.handleSubmit(onSubmit)} loading={isLoading}>
          Login
        </Button>

        <View className="flex-row justify-end mt-2">
          <Text className="text-lynx-primary-container font-semibold text-sm">Forgot Password?</Text>
        </View>

        <View className="flex-row items-center gap-3 mt-4">
          <View className="flex-1 h-px bg-lynx-outline-variant" />
          <Text className="text-lynx-secondary text-sm">or</Text>
          <View className="flex-1 h-px bg-lynx-outline-variant" />
        </View>

        <Button variant="secondary" onPress={() => {}}>
          Continue with Google
        </Button>
      </View>
    </FormProvider>
  );
}
