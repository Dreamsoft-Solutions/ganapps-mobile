import AntDesign from '@expo/vector-icons/AntDesign';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Eye, EyeOff } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { useCallback, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { Button } from '@/components/common/Button';
import { Divider } from '@/components/common/Divider';
import { IconButton } from '@/components/common/IconButton';
import { Input } from '@/components/common/Input';
import { Text } from '@/components/common/Text';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import { getGoogleFirebaseIdToken, isGoogleSignInCancelled } from '@/services/google-auth.service';
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

/**
 * Google brand icon used in the social sign-in button.
 *
 * @returns The Google brand glyph rendered on native and web.
 */
function GoogleIcon(): ReactElement {
  return (
    <AntDesign
      name="google"
      size={20}
      color={Colors[useResolvedTheme()].primary}
      accessibilityLabel="Google logo"
      accessibilityRole="image"
    />
  );
}

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
        const color: string = met ? Colors[theme].primary : Colors[theme]['muted-foreground'];

        return (
          <View key={requirement.id} className="flex-row items-center gap-2">
            <Check size={14} color={color} strokeWidth={met ? 2.5 : 1.5} />
            <Text className={met ? 'text-label-sm text-primary' : 'text-label-sm text-muted-foreground'}>
              {requirement.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/**
 * Authentication form that toggles between login and sign-up modes.
 *
 * @returns The login/sign-up form with email/password fields and social sign-in.
 */
export function LoginForm(): ReactElement {
  const { login, register, googleLogin, isLoading, loginMutation, registerMutation, googleLoginMutation } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [googleError, setGoogleError] = useState<string | undefined>();

  const isLogin = mode === 'login';
  const schema = isLogin ? loginSchema : registerSchema;
  const mutedColor = Colors[useResolvedTheme()]['muted-foreground'];
  const googleAuthEnabled = useFeatureFlag('feature_google_auth');

  const methods = useForm<LoginFormData | RegisterFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      password: '',
      ...(isLogin ? {} : { username: '', confirmPassword: '' }),
    },
  });
  const watchedPassword: unknown = methods.watch('password');
  const passwordValue: string = typeof watchedPassword === 'string' ? watchedPassword : '';

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
    setGoogleError(undefined);
    // Otherwise a failed login's message stays on screen under the signup form.
    loginMutation.reset();
    registerMutation.reset();
    googleLoginMutation.reset();
  }, [methods, loginMutation, registerMutation, googleLoginMutation]);

  // The rejection is swallowed here on purpose: the failure is rendered from the
  // mutation's own `error` below. Letting it escape leaves an unhandled rejection
  // and shows the user nothing at all.
  const onSubmit = useCallback(
    async (data: LoginFormData | RegisterFormData): Promise<void> => {
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
    [isLogin, login, register],
  );

  const submitError: string | undefined = isLogin
    ? (googleLoginMutation.error?.message ?? googleError ?? loginMutation.error?.message)
    : registerMutation.error?.message;

  const handleGoogleLogin = useCallback(async (): Promise<void> => {
    setGoogleError(undefined);
    try {
      const idToken = await getGoogleFirebaseIdToken();
      await googleLogin({ idToken });
    } catch (error: unknown) {
      if (isGoogleSignInCancelled(error)) return;
      setGoogleError(error instanceof Error ? error.message : 'Google sign-in failed');
    }
  }, [googleLogin]);

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
          <Input
            name="username"
            label="Username"
            labelHint={USERNAME_HINT}
            placeholder="johndoe"
            autoCapitalize="none"
            autoCorrect={false}
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
          secureTextEntry={!showPassword}
          iconRight={passwordToggle}
          maxLength={isLogin ? undefined : PASSWORD_POLICY.maxLength}
        />

        {!isLogin && <PasswordChecklist password={passwordValue} />}

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

        {submitError && (
          <Text className="text-destructive text-body-md text-center" accessibilityRole="alert">
            {submitError}
          </Text>
        )}

        <Button onPress={methods.handleSubmit(onSubmit)} loading={isLoading} size="lg">
          {isLogin ? 'Log In' : 'Create Account'}
        </Button>

        {googleAuthEnabled && (
          <>
            <Divider label="or" />

            <Button
              variant="outline"
              onPress={handleGoogleLogin}
              size="lg"
              leftIcon={<GoogleIcon />}
              loading={googleLoginMutation.isPending}
              disabled={googleLoginMutation.isPending}
            >
              Continue with Google
            </Button>
          </>
        )}

        <View className="flex-row justify-center items-center mt-2">
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
