import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { useCallback, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { Button } from '@/components/common/Button';
import { Divider } from '@/components/common/Divider';
import { Input } from '@/components/common/Input';
import { LegalLinks } from '@/components/common/LegalLinks';
import { Text } from '@/components/common/Text';
import { PasswordVisibilityToggle } from '@/components/forms/PasswordVisibilityToggle';
import { SocialSignInButtons } from '@/components/forms/SocialSignInButtons';
import { Routes } from '@/constants/routes';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import { useSocialSignIn } from '@/hooks/useSocialSignIn';
import type { LoginDto, RegisterDto } from '@/types/auth.types';
import {
  getPasswordRequirementStatus,
  type LoginFormData,
  loginSchema,
  PASSWORD_POLICY,
  type RegisterFormData,
  registerSchema,
  USERNAME_POLICY,
} from '@/utils/validation';

const USERNAME_HINT = {
  title: 'Username requirements',
  message: `Pick a username that is ${USERNAME_POLICY.minLength}–${USERNAME_POLICY.maxLength} characters long with no spaces or other whitespace. Letters, numbers, and punctuation are welcome.`,
} as const;

interface PasswordChecklistProps {
  password: string;
}

/**
 * Shows the signup password rules as the user types.
 *
 * @param props - Current signup password
 * @returns The password requirements checklist
 */
function PasswordChecklist({ password }: PasswordChecklistProps): ReactElement {
  const theme = useResolvedTheme();
  const status = getPasswordRequirementStatus(password);

  return (
    <View className="-mt-2 mb-2 gap-1" accessibilityLabel="Password requirements">
      {PASSWORD_POLICY.requirements.map((requirement): ReactElement => {
        const met: boolean = status[requirement.id];
        const color: string = met ? Colors[theme]['primary-text'] : Colors[theme]['muted-foreground'];

        return (
          <View key={requirement.id} className="flex-row items-center gap-2">
            <Check size={14} color={color} strokeWidth={met ? 2.5 : 1.5} />
            <Text className={met ? 'text-label-sm text-primary-text' : 'text-label-sm text-muted-foreground'}>
              {requirement.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** Which of the form's two modes is showing. */
export type LoginFormMode = 'login' | 'signup';

interface LoginFormProps {
  /** Mode the form opens in. Defaults to `'login'`. */
  initialMode?: LoginFormMode;
}

/**
 * Authentication form that toggles between login and sign-up modes.
 *
 * @param props - The mode to open in
 * @returns The login/sign-up form with email/password fields and social sign-in.
 */
export function LoginForm({ initialMode = 'login' }: LoginFormProps): ReactElement {
  const auth = useAuth();
  const { login, register, isLoading, loginMutation, registerMutation } = auth;
  const router = useRouter();
  const [mode, setMode] = useState<LoginFormMode>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const isLogin = mode === 'login';
  const schema = isLogin ? loginSchema : registerSchema;

  const clearFormErrors = useCallback((): void => {
    loginMutation.reset();
    registerMutation.reset();
  }, [loginMutation, registerMutation]);
  const social = useSocialSignIn(auth, clearFormErrors);

  const methods = useForm<LoginFormData | RegisterFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      password: '',
      ...(isLogin ? {} : { username: '', confirmPassword: '' }),
    },
  });
  const passwordValue: string = methods.watch('password');

  const { clearError: clearSocialError } = social;
  const clearSignInErrors = useCallback((): void => {
    clearSocialError();
    clearFormErrors();
  }, [clearSocialError, clearFormErrors]);

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
    clearSignInErrors();
  }, [methods, clearSignInErrors]);

  // The rejection is swallowed here on purpose: the failure is rendered from the
  // mutation's own `error` below. Letting it escape leaves an unhandled rejection
  // and shows the user nothing at all.
  const onSubmit = useCallback(
    async (data: LoginFormData | RegisterFormData): Promise<void> => {
      clearSignInErrors();
      try {
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
      } catch {
        // Rendered from loginMutation.error / registerMutation.error.
      }
    },
    [isLogin, login, register, clearSignInErrors],
  );

  const formError: Error | null = isLogin ? loginMutation.error : registerMutation.error;
  const submitError: string | undefined = social.error ?? formError?.message;

  const passwordToggle = (
    <PasswordVisibilityToggle
      onPress={(): void => setShowPassword((previous: boolean): boolean => !previous)}
      visible={showPassword}
      label="password"
    />
  );

  const confirmPasswordToggle = (
    <PasswordVisibilityToggle
      onPress={(): void => setShowConfirmPassword((previous: boolean): boolean => !previous)}
      visible={showConfirmPassword}
      label="confirm password"
    />
  );

  return (
    <FormProvider {...methods}>
      <View className="gap-4">
        {!isLogin && (
          <Input
            name="username"
            label="Username"
            labelHint={USERNAME_HINT}
            placeholder="johndoe"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={USERNAME_POLICY.maxLength}
            helperText={`${USERNAME_POLICY.minLength}–${USERNAME_POLICY.maxLength} characters; no spaces.`}
          />
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
          placeholder={isLogin ? 'Min. 8 characters' : '8-128 characters'}
          autoCapitalize="none"
          secureTextEntry={!showPassword}
          iconRight={passwordToggle}
          maxLength={isLogin ? undefined : PASSWORD_POLICY.maxLength}
        />

        {!isLogin && <PasswordChecklist password={passwordValue} />}

        {!isLogin && (
          <Input
            name="confirmPassword"
            label="Confirm password"
            placeholder="Re-enter your password"
            autoCapitalize="none"
            secureTextEntry={!showConfirmPassword}
            iconRight={confirmPasswordToggle}
          />
        )}

        {isLogin && (
          <View className="flex-row justify-end -mt-2 mb-2">
            <Button
              variant="link"
              size="sm"
              onPress={(): void => router.push(Routes.auth.forgotPassword(methods.getValues('email')))}
            >
              Forgot password?
            </Button>
          </View>
        )}

        {submitError && (
          <Text className="text-destructive text-body-md text-center" accessibilityRole="alert">
            {submitError}
          </Text>
        )}

        <Button onPress={methods.handleSubmit(onSubmit)} loading={isLoading} size="auth">
          {isLogin ? 'Log in' : 'Create account'}
        </Button>

        {(social.showApple || social.showGoogle) && <Divider label="or" />}
        <SocialSignInButtons social={social} />

        <View className="flex-row justify-center items-center mt-2">
          <Text className="text-muted-foreground text-body-md">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
          </Text>
          <Button variant="link" size="sm" onPress={toggleMode}>
            {isLogin ? 'Sign up' : 'Log in'}
          </Button>
        </View>

        <Text className="text-muted-foreground text-label-sm text-center mt-4 px-2">
          By continuing, you agree to our Terms and Privacy Policy.
        </Text>
        <LegalLinks />
      </View>
    </FormProvider>
  );
}
