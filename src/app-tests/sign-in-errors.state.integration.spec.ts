/** @vitest-environment happy-dom */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { act, createElement, Fragment, type ReactElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axiosInstance } from '@/api/axios-instance';
import { LoginForm } from '@/components/forms/LoginForm';

const APPLE_NO_ACCOUNT =
  "Couldn't sign in with Apple. Check that you're signed in to an Apple Account in Settings, then try again.";
const APPLE_FAILED = "Couldn't sign in with Apple. Try again.";
const GOOGLE_FAILED = "Couldn't sign in with Google. Try again.";

const native = vi.hoisted(() => ({
  appleSignIn: vi.fn(),
  googleSignIn: vi.fn(),
  firebaseSignIn: vi.fn(),
  lastPress: Promise.resolve() as Promise<unknown>,
}));

interface NativeProps {
  children?: ReactNode | ((state: { pressed: boolean }) => ReactNode);
  onPress?: () => unknown;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: string;
}

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

vi.mock('react-native', () => {
  const content = (children: NativeProps['children']): ReactNode =>
    typeof children === 'function' ? children({ pressed: false }) : children;
  const box =
    (tag: string) =>
    (props: NativeProps): ReactElement =>
      createElement(tag, { role: props.accessibilityRole }, content(props.children));
  return {
    View: box('div'),
    Text: box('span'),
    Pressable: (props: NativeProps): ReactElement =>
      createElement(
        'button',
        {
          type: 'button',
          'aria-label': props.accessibilityLabel,
          disabled: props.disabled,
          onClick: (): void => {
            native.lastPress = Promise.resolve(props.onPress?.());
          },
        },
        content(props.children),
      ),
    TextInput: (): ReactElement => createElement('input'),
    ActivityIndicator: (): null => null,
    Linking: { openURL: vi.fn() },
    Platform: { OS: 'ios', select: (options: { ios?: unknown; default?: unknown }): unknown => options.ios },
    useColorScheme: (): string => 'light',
  };
});
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: async (): Promise<null> => null, setItem: vi.fn(), removeItem: vi.fn() },
}));
vi.mock('expo-secure-store', () => ({}));
vi.mock('@/utils/secure-storage', () => ({
  secureStorage: {
    setTokens: vi.fn().mockResolvedValue(undefined),
    getAccessToken: vi.fn().mockResolvedValue(null),
    getRefreshToken: vi.fn().mockResolvedValue(null),
    getExpiresAt: vi.fn().mockResolvedValue(null),
    clearTokens: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('@/services/push-notification.service', () => ({ revokeRegisteredPushTokens: vi.fn() }));
vi.mock('expo-router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useLocalSearchParams: () => ({}),
}));
vi.mock('expo-constants', () => ({ default: { expoConfig: { extra: { googleWebClientId: 'web-client-id' } } } }));
vi.mock('@expo/vector-icons/AntDesign', () => ({ default: (): null => null }));
vi.mock('lucide-react-native', () => ({
  LucideProvider: ({ children }: { children: ReactNode }): ReactElement => createElement(Fragment, null, children),
  Check: (): null => null,
  CircleHelp: (): null => null,
  Eye: (): null => null,
  EyeOff: (): null => null,
}));
vi.mock('@/hooks/useSocialSignInOptions', () => ({
  useSocialSignInOptions: () => ({ showApple: true, showGoogle: true }),
}));
vi.mock('expo-apple-authentication', () => ({
  signInAsync: native.appleSignIn,
  AppleAuthenticationButton: (): null => null,
  AppleAuthenticationButtonStyle: { WHITE: 0, BLACK: 2 },
  AppleAuthenticationButtonType: { CONTINUE: 1 },
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));
vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  getRandomBytes: (count: number): Uint8Array => new Uint8Array(count),
  digestStringAsync: async (): Promise<string> => 'hashed-nonce',
}));
vi.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: vi.fn(),
    hasPlayServices: vi.fn().mockResolvedValue(true),
    signIn: native.googleSignIn,
    getTokens: vi.fn().mockResolvedValue({ accessToken: 'google-access-token' }),
    signOut: vi.fn().mockResolvedValue(undefined),
  },
  isSuccessResponse: (response: { type: string }): boolean => response.type === 'success',
  isErrorWithCode: (error: unknown): boolean => typeof error === 'object' && error !== null && 'code' in error,
}));
vi.mock('@react-native-firebase/app', () => ({ getApp: () => ({}) }));
vi.mock('@react-native-firebase/auth', () => ({
  GoogleAuthProvider: { credential: () => ({}) },
  getAuth: () => ({}),
  getIdToken: async (): Promise<string> => 'firebase-id-token',
  signInWithCredential: native.firebaseSignIn,
  signOut: vi.fn().mockResolvedValue(undefined),
}));

/** Builds the rejection Expo raises on iOS, whose message is the exception's debug description. */
function expoAppleError(code: string, debugDescription: string): Error {
  return Object.assign(new Error(debugDescription), { code });
}

const requests: string[] = [];
const serverRejections: Record<string, { status: number; message: string }> = {};

function authServer(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
  const request = `${config.method} ${config.url}`;
  requests.push(request);
  const rejection = serverRejections[request];
  if (rejection === undefined) throw new Error(`Unexpected request: ${request}`);
  throw new AxiosError(`Request failed with status code ${rejection.status}`, 'ERR_BAD_REQUEST', config, null, {
    config,
    data: { success: false, statusCode: rejection.status, errorCode: 'UNAUTHORIZED', message: rejection.message },
    status: rejection.status,
    statusText: 'Rejected',
    headers: {},
  });
}

const originalAdapter: typeof axiosInstance.defaults.adapter = axiosInstance.defaults.adapter;
let client: QueryClient;
let root: Root | null = null;
let container: HTMLDivElement;

beforeEach(async (): Promise<void> => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  axiosInstance.defaults.adapter = authServer;
  container = document.createElement('div');
  root = createRoot(container);
  await act(async (): Promise<void> => {
    root?.render(createElement(QueryClientProvider, { client }, createElement(LoginForm)));
  });
});

afterEach(async (): Promise<void> => {
  await act(async (): Promise<void> => {
    root?.unmount();
  });
  root = null;
  client.clear();
  axiosInstance.defaults.adapter = originalAdapter;
  requests.length = 0;
  for (const key of Object.keys(serverRejections)) delete serverRejections[key];
  native.appleSignIn.mockReset();
  native.googleSignIn.mockReset();
  native.firebaseSignIn.mockReset();
});

/** Taps a button and waits for its whole sign-in handler to finish and render. */
async function tap(label: string): Promise<void> {
  const button: HTMLButtonElement | null = container.querySelector(`[aria-label="${label}"]`);
  if (button === null) throw new Error(`No button labelled ${label}`);
  await act(async (): Promise<void> => {
    button.click();
    await native.lastPress;
  });
}

function shownError(): string | null {
  return container.querySelector('[role="alert"]')?.textContent ?? null;
}

describe('Sign in with Apple errors', (): void => {
  it('points to Settings, not the native text, when no Apple Account is signed in', async (): Promise<void> => {
    native.appleSignIn.mockRejectedValue(
      expoAppleError(
        'ERR_REQUEST_UNKNOWN',
        'RequestUnknownException: The authorization attempt failed for an unknown reason (at ExpoAppleAuthentication/AppleAuthenticationExceptions.swift:61)',
      ),
    );

    await tap('Continue with Apple');

    expect(shownError()).toBe(APPLE_NO_ACCOUNT);
    expect(container.textContent).not.toContain('Exception');
    expect(requests).toEqual([]);
  });

  it('shows nothing when the sheet is cancelled', async (): Promise<void> => {
    native.appleSignIn.mockRejectedValue(
      expoAppleError('ERR_REQUEST_CANCELED', 'RequestCanceledException: The user canceled the authorization attempt'),
    );

    await tap('Continue with Apple');

    expect(native.appleSignIn).toHaveBeenCalledOnce();
    expect(shownError()).toBeNull();
  });

  it('shows plain copy for any other Apple failure', async (): Promise<void> => {
    native.appleSignIn.mockRejectedValue(
      expoAppleError('ERR_REQUEST_FAILED', 'RequestFailedException: The authorization attempt failed'),
    );

    await tap('Continue with Apple');

    expect(shownError()).toBe(APPLE_FAILED);
  });

  it('keeps the server message when the Ganapps API rejects the credential', async (): Promise<void> => {
    native.appleSignIn.mockResolvedValue({
      user: 'apple-user',
      identityToken: 'identity-token',
      authorizationCode: 'authorization-code',
      fullName: null,
    });
    serverRejections['post /auth/apple'] = { status: 401, message: 'Invalid or expired Apple sign-in' };

    await tap('Continue with Apple');

    expect(shownError()).toBe('Invalid or expired Apple sign-in');
    expect(requests).toEqual(['post /auth/apple']);
  });
});

describe('Sign in with Google errors', (): void => {
  it('shows nothing when the Google sheet is cancelled', async (): Promise<void> => {
    native.googleSignIn.mockResolvedValue({ type: 'cancelled', data: null });

    await tap('Continue with Google');

    expect(native.googleSignIn).toHaveBeenCalledOnce();
    expect(shownError()).toBeNull();
    expect(requests).toEqual([]);
  });

  it('shows plain copy, not the Firebase text, when Firebase Auth fails', async (): Promise<void> => {
    native.googleSignIn.mockResolvedValue({ type: 'success', data: { idToken: 'google-id-token' } });
    native.firebaseSignIn.mockRejectedValue(
      Object.assign(new Error('[auth/network-request-failed] A network error has occurred.'), {
        code: 'auth/network-request-failed',
      }),
    );

    await tap('Continue with Google');

    expect(shownError()).toBe(GOOGLE_FAILED);
    expect(requests).toEqual([]);
  });

  it('keeps the server message when the Ganapps API rejects the Google account', async (): Promise<void> => {
    native.googleSignIn.mockResolvedValue({ type: 'success', data: { idToken: 'google-id-token' } });
    native.firebaseSignIn.mockResolvedValue({ user: {} });
    serverRejections['post /auth/google'] = {
      status: 409,
      message: 'This email is already linked to another Google account',
    };

    await tap('Continue with Google');

    expect(shownError()).toBe('This email is already linked to another Google account');
    expect(requests).toEqual(['post /auth/google']);
  });
});
