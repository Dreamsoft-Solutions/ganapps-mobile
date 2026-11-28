import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { Circle as CircleOpen, CircleCheck } from 'lucide-react-native';
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
 * Shows the signup password rules as the user types: an open circle for a rule still to meet, a
 * filled check in `primary-text` once it is met, so the state never rests on color alone. Each
 * row tells screen readers whether its rule is met.
 *
 * @param props - Current signup password
 * @returns The password requirements checklist
 */
function PasswordChecklist({ password }: PasswordChecklistProps): ReactElement {
  const theme = useResolvedTheme();
  const status = getPasswordRequirementStatus(password);

  return (
    <View className="-mt-xs mb-md gap-1" accessibilityLabel="Password requirements">
      {PASSWORD_POLICY.requirements.map((requirement): ReactElement => {
        const met: boolean = status[requirement.id];
        const color: string = met ? Colors[theme]['primary-text'] : Colors[theme]['muted-foreground'];
        const Icon = met ? CircleCheck : CircleOpen;

        return (
          <View
            key={requirement.id}
            className="flex-row items-center gap-2"
            accessible
            accessibilityLabel={`${requirement.label}, ${met ? 'met' : 'not met yet'}`}
          >
            <Icon size={14} color={color} strokeWidth={met ? 2.25 : 1.75} />
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
  /** The mode showing. The screen owns it, because its title follows the mode. */
  mode: LoginFormMode;
  /** Called with the other mode when the person follows the Sign up or Log in link. */
  onModeChange: (mode: LoginFormMode) => void;
}

/**
 * Authentication form for log in and sign up, drawn inside `AuthScreen`. Fields chain with the
 * keyboard's next key and carry autofill hints, so a password manager can fill them. Under the
 * main action sit Apple and Google, the link to the other mode, and the Terms and Privacy links on
 * one line, as on Welcome.
 *
 * @param props - The mode showing and the handler that switches it
 * @returns The login/sign-up form with email/password fields and social sign-in.
 * @example
 * const [mode, setMode] = useState<LoginFormMode>('login');
 * <LoginForm mode={mode} onModeChange={setMode} />
 */
export function LoginForm({ mode, onModeChange }: LoginFormProps): ReactElement {
  const auth = useAuth();
  const { login, register, isLoading, loginMutation, registerMutation } = auth;
  const router = useRouter();
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

  const toggleMode = useCallback((): void => {
    onModeChange(isLogin ? 'signup' : 'login');
    methods.reset({
      email: '',
      password: '',
      username: '',
      confirmPassword: '',
    });
    setShowPassword(false);
    setShowConfirmPassword(false);
    clearSignInErrors();
  }, [isLogin, onModeChange, methods, clearSignInErrors]);

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

  const submit = methods.handleSubmit(onSubmit);

  return (
    <FormProvider {...methods}>
      <View>
        {!isLogin && (
          <Input
            name="username"
            label="Username"
            labelHint={USERNAME_HINT}
            placeholder="johndoe"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username-new"
            textContentType="username"
            returnKeyType="next"
            onSubmitEditing={(): void => methods.setFocus('email')}
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
          autoComplete="email"
          textContentType={isLogin ? 'username' : 'emailAddress'}
          returnKeyType="next"
          onSubmitEditing={(): void => methods.setFocus('password')}
        />

        <Input
          name="password"
          label="Password"
          placeholder={isLogin ? 'Your password' : '8-128 characters'}
          autoCapitalize="none"
          secureTextEntry={!showPassword}
          iconRight={passwordToggle}
          autoComplete={isLogin ? 'current-password' : 'new-password'}
          textContentType={isLogin ? 'password' : 'newPassword'}
          returnKeyType={isLogin ? 'go' : 'next'}
          onSubmitEditing={isLogin ? submit : (): void => methods.setFocus('confirmPassword')}
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
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={submit}
          />
        )}

        {isLogin && (
          <View className="-mt-xs mb-sm flex-row justify-end">
            <Button
              variant="link"
              onPress={(): void => router.push(Routes.auth.forgotPassword(methods.getValues('email')))}
            >
              Forgot password?
            </Button>
          </View>
        )}

        <View className="mt-xs gap-sm">
          {submitError && (
            <Text className="text-center text-body-md text-destructive" accessibilityRole="alert">
              {submitError}
            </Text>
          )}

          <Button onPress={submit} loading={isLoading} size="auth">
            {isLogin ? 'Log in' : 'Create account'}
          </Button>

          {(social.showApple || social.showGoogle) && (
            <View className="-my-sm">
              <Divider label="or" />
            </View>
          )}
          <SocialSignInButtons social={social} />
        </View>

        <View className="mt-lg flex-row flex-wrap items-center justify-center">
          <Text className="text-body-md text-muted-foreground">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
          </Text>
          <Button variant="link" onPress={toggleMode}>
            {isLogin ? 'Sign up' : 'Log in'}
          </Button>
        </View>

        <View className="mt-md items-center">
          <Text className="text-center text-label-sm text-muted-foreground">By continuing you agree to our</Text>
          <LegalLinks inline />
        </View>
      </View>
    </FormProvider>
  );
}
