import AntDesign from '@expo/vector-icons/AntDesign';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AppleAuthenticationButton,
  AppleAuthenticationButtonStyle,
  AppleAuthenticationButtonType,
} from 'expo-apple-authentication';
import { useRouter } from 'expo-router';
import { Check, Eye, EyeOff } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { useCallback, useRef, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { Button, buttonSizeTargets } from '@/components/common/Button';
import { Divider } from '@/components/common/Divider';
import { IconButton } from '@/components/common/IconButton';
import { Input } from '@/components/common/Input';
import { LegalLinks } from '@/components/common/LegalLinks';
import { Text } from '@/components/common/Text';
import { Routes } from '@/constants/routes';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import { useSocialSignInOptions } from '@/hooks/useSocialSignInOptions';
import { clearPendingAppleName, getAppleSignInCredential, isAppleSignInCancelled } from '@/services/apple-auth.service';
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

/**
 * Picks the one error to show, preferring social sign-in failures over the form's own.
 *
 * @param socialMutationErrors - Errors from the Google and Apple mutations
 * @param socialError - Error set by a failed social sign-in before its request
 * @param formError - Error from the active login or register mutation
 * @returns The message to display, if any
 */
function pickSubmitError(
  socialMutationErrors: (Error | null)[],
  socialError: string | undefined,
  formError: Error | null,
): string | undefined {
  const mutationMessage: string | undefined = socialMutationErrors.find(Boolean)?.message;
  return mutationMessage ?? socialError ?? formError?.message;
}

interface AppleSignInButtonProps {
  theme: 'light' | 'dark';
  pending: boolean;
  onPress: () => Promise<void>;
}

/**
 * Apple's native Continue with Apple button, dimmed while a sign-in is running.
 *
 * @param props - Resolved theme, pending flag and press handler
 * @returns The native button inside an opacity wrapper
 */
function AppleSignInButton({ theme, pending, onPress }: AppleSignInButtonProps): ReactElement {
  return (
    <View className={pending ? 'opacity-60' : undefined}>
      <AppleAuthenticationButton
        buttonType={AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={theme === 'dark' ? AppleAuthenticationButtonStyle.WHITE : AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={16}
        style={{ width: '100%', height: buttonSizeTargets.lg.target.sizePx }}
        onPress={onPress}
      />
    </View>
  );
}

interface SocialSignInProps {
  showApple: boolean;
  showGoogle: boolean;
  theme: 'light' | 'dark';
  applePending: boolean;
  googlePending: boolean;
  onApplePress: () => Promise<void>;
  onGooglePress: () => Promise<void>;
}

/**
 * The "or" divider with the Apple button above the Google button.
 *
 * @param props - Which providers to show, their pending state and press handlers
 * @returns The social sign-in block, or null when no provider is available
 */
function SocialSignIn(props: SocialSignInProps): ReactElement | null {
  if (!props.showApple && !props.showGoogle) return null;
  return (
    <>
      <Divider label="or" />

      {props.showApple && (
        <AppleSignInButton theme={props.theme} pending={props.applePending} onPress={props.onApplePress} />
      )}

      {props.showGoogle && (
        <Button
          variant="outline"
          onPress={props.onGooglePress}
          size="lg"
          leftIcon={<GoogleIcon />}
          loading={props.googlePending}
          disabled={props.googlePending}
        >
          Continue with Google
        </Button>
      )}
    </>
  );
}

interface PasswordChecklistProps {
  password: string;
}

function PasswordVisibilityToggle({
  visible,
  onPress,
  label,
}: {
  visible: boolean;
  onPress: () => void;
  label: string;
}): ReactElement {
  const color: string = Colors[useResolvedTheme()]['muted-foreground'];
  return (
    <IconButton
      onPress={onPress}
      accessibilityLabel={`${visible ? 'Hide' : 'Show'} ${label}`}
      size="sm"
      variant="ghost"
    >
      {visible ? <EyeOff size={18} color={color} /> : <Eye size={18} color={color} />}
    </IconButton>
  );
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
  const {
    login,
    register,
    googleLogin,
    appleLogin,
    isLoading,
    loginMutation,
    registerMutation,
    googleLoginMutation,
    appleLoginMutation,
  } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [socialError, setSocialError] = useState<string | undefined>();

  const isLogin = mode === 'login';
  const schema = isLogin ? loginSchema : registerSchema;
  const { showApple, showGoogle } = useSocialSignInOptions();
  const theme = useResolvedTheme();
  const appleInFlight = useRef<boolean>(false);

  const methods = useForm<LoginFormData | RegisterFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      password: '',
      ...(isLogin ? {} : { username: '', confirmPassword: '' }),
    },
  });
  const passwordValue: string = methods.watch('password');

  const clearSignInErrors = useCallback((): void => {
    setSocialError(undefined);
    loginMutation.reset();
    registerMutation.reset();
    googleLoginMutation.reset();
    appleLoginMutation.reset();
  }, [loginMutation, registerMutation, googleLoginMutation, appleLoginMutation]);

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

  const submitError: string | undefined = pickSubmitError(
    [googleLoginMutation.error, appleLoginMutation.error],
    socialError,
    isLogin ? loginMutation.error : registerMutation.error,
  );

  const handleGoogleLogin = useCallback(async (): Promise<void> => {
    clearSignInErrors();
    try {
      const idToken = await getGoogleFirebaseIdToken();
      await googleLogin({ idToken });
    } catch (error: unknown) {
      if (isGoogleSignInCancelled(error)) return;
      setSocialError(error instanceof Error ? error.message : 'Google sign-in failed');
    }
  }, [googleLogin, clearSignInErrors]);

  const handleAppleLogin = useCallback(async (): Promise<void> => {
    if (appleInFlight.current) return;
    appleInFlight.current = true;
    clearSignInErrors();
    try {
      const dto = await getAppleSignInCredential();
      await appleLogin(dto);
      clearPendingAppleName();
    } catch (error: unknown) {
      if (isAppleSignInCancelled(error)) return;
      setSocialError(error instanceof Error && error.message ? error.message : 'Apple sign-in failed');
    } finally {
      appleInFlight.current = false;
    }
  }, [appleLogin, clearSignInErrors]);

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
            label="Confirm Password"
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
              Forgot Password?
            </Button>
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

        <SocialSignIn
          showApple={showApple}
          showGoogle={showGoogle}
          theme={theme}
          applePending={appleLoginMutation.isPending}
          googlePending={googleLoginMutation.isPending}
          onApplePress={handleAppleLogin}
          onGooglePress={handleGoogleLogin}
        />

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
        <LegalLinks />
      </View>
    </FormProvider>
  );
}
