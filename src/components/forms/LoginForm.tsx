import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { useCallback, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useColorScheme, View } from 'react-native';
import { Button } from '@/components/common/Button';
import { Divider } from '@/components/common/Divider';
import { IconButton } from '@/components/common/IconButton';
import { Input } from '@/components/common/Input';
import { Text } from '@/components/common/Text';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import type { LoginDto, RegisterDto } from '@/types/auth.types';
import { type LoginFormData, loginSchema, type RegisterFormData, registerSchema } from '@/utils/validation';

/**
 * Google brand icon used in the social sign-in button.
 *
 * @returns A styled "G" badge that renders on native and web.
 */
function GoogleIcon(): ReactElement {
  return (
    <View
      className="w-5 h-5 rounded-full bg-white border border-border items-center justify-center"
      accessibilityLabel="Google logo"
      accessibilityRole="image"
    >
      <Text className="text-base font-inter-bold text-primary">G</Text>
    </View>
  );
}

/**
 * Authentication form that toggles between login and sign-up modes.
 *
 * @returns The login/sign-up form with email/password fields and social sign-in.
 */
export function LoginForm(): ReactElement {
  const { login, register, isLoading } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const isLogin = mode === 'login';
  const schema = isLogin ? loginSchema : registerSchema;
  const colorScheme = useColorScheme();
  const mutedColor = Colors[colorScheme === 'dark' ? 'dark' : 'light']['muted-foreground'];

  const methods = useForm<LoginFormData | RegisterFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      password: '',
      ...(isLogin ? {} : { username: '', confirmPassword: '' }),
    },
  });

  const toggleMode = useCallback(() => {
    setMode((previous) => (previous === 'login' ? 'signup' : 'login'));
    methods.reset({
      email: '',
      password: '',
      username: '',
      confirmPassword: '',
    });
    setShowPassword(false);
    setShowConfirmPassword(false);
  }, [methods]);

  const onSubmit = useCallback(
    async (data: LoginFormData | RegisterFormData): Promise<void> => {
      if (isLogin) {
        const loginData = data as LoginFormData;
        const dto: LoginDto = { email: loginData.email, password: loginData.password };
        await login(dto);
        return;
      }

      const signupData = data as RegisterFormData;
      const dto: RegisterDto = {
        email: signupData.email,
        password: signupData.password,
        username: signupData.username,
      };
      await register(dto);
    },
    [isLogin, login, register],
  );

  const handleGoogleLogin = useCallback(async (): Promise<void> => {
    // TODO: integrate Google Sign-In SDK and exchange idToken via useAuth().googleLogin
  }, []);

  const passwordToggle = (
    <IconButton
      onPress={(): void => setShowPassword((previous: boolean): boolean => !previous)}
      accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
      size="sm"
      variant="ghost"
    >
      {showPassword ? <EyeOff size={18} color={mutedColor} /> : <Eye size={18} color={mutedColor} />}
    </IconButton>
  );

  const confirmPasswordToggle = (
    <IconButton
      onPress={(): void => setShowConfirmPassword((previous: boolean): boolean => !previous)}
      accessibilityLabel={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
      size="sm"
      variant="ghost"
    >
      {showConfirmPassword ? <EyeOff size={18} color={mutedColor} /> : <Eye size={18} color={mutedColor} />}
    </IconButton>
  );

  return (
    <FormProvider {...methods}>
      <View className="gap-4">
        {!isLogin && (
          <Input name="username" label="Username" placeholder="johndoe" autoCapitalize="none" autoCorrect={false} />
        )}

        <Input
          name="email"
          label="Email"
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Input
          name="password"
          label="Password"
          placeholder="Min. 8 characters"
          secureTextEntry={!showPassword}
          iconRight={passwordToggle}
        />

        {!isLogin && (
          <Input
            name="confirmPassword"
            label="Confirm Password"
            placeholder="Re-enter your password"
            secureTextEntry={!showConfirmPassword}
            iconRight={confirmPasswordToggle}
          />
        )}

        {isLogin && (
          <View className="flex-row justify-end -mt-2 mb-2">
            <Text className="text-primary font-inter-semibold text-body-md">Forgot Password?</Text>
          </View>
        )}

        <Button onPress={methods.handleSubmit(onSubmit)} loading={isLoading} size="lg">
          {isLogin ? 'Log In' : 'Create Account'}
        </Button>

        <Divider label="or" />

        <Button variant="outline" onPress={handleGoogleLogin} size="lg" leftIcon={<GoogleIcon />}>
          Continue with Google
        </Button>

        <View className="flex-row justify-center mt-2">
          <Text className="text-muted-foreground text-body-md">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
          </Text>
          <Button variant="link" size="sm" onPress={toggleMode}>
            {isLogin ? 'Sign Up' : 'Log In'}
          </Button>
        </View>

        <Text className="text-muted-foreground text-label-sm text-center mt-4 px-2">
          By continuing, you agree to our Terms and Privacy Policy.
        </Text>
      </View>
    </FormProvider>
  );
}
