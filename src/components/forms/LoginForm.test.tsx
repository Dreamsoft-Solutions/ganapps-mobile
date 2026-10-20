import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

jest.mock(
  '@expo/vector-icons/AntDesign',
  () => {
    const React = require('react') as typeof import('react');
    const { Text: NativeText } = require('react-native') as typeof import('react-native');

    return {
      __esModule: true,
      default: ({ name, size }: { name: string; size: number }): ReactElement =>
        React.createElement(NativeText, { testID: 'google-icon' }, `${name}:${size}`),
    };
  },
  { virtual: true },
);

jest.mock('lucide-react-native', () => {
  const React = require('react') as typeof import('react');

  return {
    Check: (): null => null,
    CircleHelp: (): null => null,
    Eye: (): null => null,
    EyeOff: (): null => null,
    LucideProvider: ({ children }: { children?: ReactNode }): ReactElement =>
      React.createElement(React.Fragment, null, children),
  };
});

const mockApple: { press: (() => Promise<void>) | undefined; props: Record<string, unknown> | undefined } = {
  press: undefined,
  props: undefined,
};
let mockTheme: 'light' | 'dark' = 'light';
const mockOptions = { showApple: true, showGoogle: true };
const mockAppleLogin = jest.fn<(dto: unknown) => Promise<void>>();
const mockGoogleLogin = jest.fn<(dto: unknown) => Promise<void>>();
const mockGetAppleSignInCredential = jest.fn<() => Promise<unknown>>();
const mockIsAppleSignInCancelled = jest.fn<(error: unknown) => boolean>();
const mockClearPendingAppleName = jest.fn<() => void>();
const mockGetGoogleFirebaseIdToken = jest.fn<() => Promise<string>>();

jest.mock('@/hooks/useAuth', () => ({
  useAuth: (): Record<string, unknown> => {
    const React = require('react') as typeof import('react');
    const [loginError, setLoginError] = React.useState<Error | null>(null);
    return {
      login: async (): Promise<void> => {
        setLoginError(new Error('Bad login'));
        throw new Error('Bad login');
      },
      register: async (): Promise<void> => {},
      googleLogin: mockGoogleLogin,
      appleLogin: mockAppleLogin,
      isLoading: false,
      loginMutation: { error: loginError, isPending: false, reset: (): void => setLoginError(null) },
      registerMutation: { error: null, isPending: false, reset: (): void => {} },
      googleLoginMutation: { error: null, isPending: false, reset: (): void => {} },
      appleLoginMutation: { error: null, isPending: false, reset: (): void => {} },
    };
  },
}));

jest.mock('@/hooks/useSocialSignInOptions', () => ({
  useSocialSignInOptions: (): typeof mockOptions => mockOptions,
}));

jest.mock('expo-apple-authentication', () => {
  const React = require('react') as typeof import('react');
  const { Pressable } = require('react-native') as typeof import('react-native');

  return {
    AppleAuthenticationButton: (props: { onPress: () => Promise<void> }): ReactElement => {
      const { onPress } = props;
      mockApple.press = onPress;
      mockApple.props = props;
      return React.createElement(Pressable, {
        accessibilityRole: 'button',
        accessibilityLabel: 'Continue with Apple',
        onPress,
      });
    },
    AppleAuthenticationButtonType: { CONTINUE: 1 },
    AppleAuthenticationButtonStyle: { WHITE: 0, BLACK: 2 },
  };
});

jest.mock('@/services/apple-auth.service', () => ({
  getAppleSignInCredential: (): Promise<unknown> => mockGetAppleSignInCredential(),
  isAppleSignInCancelled: (error: unknown): boolean => mockIsAppleSignInCancelled(error),
  clearPendingAppleName: (): void => mockClearPendingAppleName(),
}));

jest.mock('@/hooks/useResolvedTheme', () => ({
  useResolvedTheme: (): 'light' | 'dark' => mockTheme,
}));

jest.mock('@/services/google-auth.service', () => ({
  getGoogleFirebaseIdToken: (): Promise<string> => mockGetGoogleFirebaseIdToken(),
  isGoogleSignInCancelled: (): boolean => false,
}));

import { buttonSizeTargets } from '@/components/common/Button';
import { LoginForm } from './LoginForm';

const APPLE_DTO = { identityToken: 'identity', nonce: 'nonce' };

beforeEach((): void => {
  mockTheme = 'light';
  mockApple.props = undefined;
  mockOptions.showApple = true;
  mockOptions.showGoogle = true;
  mockAppleLogin.mockReset().mockResolvedValue(undefined);
  mockGoogleLogin.mockReset().mockResolvedValue(undefined);
  mockGetAppleSignInCredential.mockReset().mockResolvedValue(APPLE_DTO);
  mockIsAppleSignInCancelled.mockReset().mockReturnValue(false);
  mockClearPendingAppleName.mockReset();
  mockGetGoogleFirebaseIdToken.mockReset().mockResolvedValue('test-token');
});

describe('LoginForm Google sign-in icon', (): void => {
  it('renders the Google glyph in both login and sign-up modes', async (): Promise<void> => {
    mockOptions.showApple = true;
    mockOptions.showGoogle = true;
    const screen = await render(<LoginForm />);

    expect(screen.getByTestId('google-icon').props.children).toBe('google:20');

    fireEvent.press(screen.getByRole('button', { name: 'Sign Up' }));

    expect(screen.getByTestId('google-icon').props.children).toBe('google:20');
  });

  it('caps signup usernames and displays their length guidance', async (): Promise<void> => {
    const screen = await render(<LoginForm />);
    fireEvent.press(screen.getByRole('button', { name: 'Sign Up' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Username').props.maxLength).toBe(32);
    });
    expect(screen.getByText('3–32 characters; no spaces.')).toBeTruthy();
  });
});

describe('LoginForm Apple sign-in', (): void => {
  it("renders Apple's Continue button at the Google button's size", async (): Promise<void> => {
    await render(<LoginForm />);

    expect(mockApple.props?.buttonType).toBe(1);
    expect(mockApple.props?.cornerRadius).toBe(16);
    expect(mockApple.props?.style).toEqual({ width: '100%', height: buttonSizeTargets.lg.target.sizePx });
  });

  it('uses the BLACK Apple button style in the light theme', async (): Promise<void> => {
    mockTheme = 'light';
    await render(<LoginForm />);

    expect(mockApple.props?.buttonStyle).toBe(2);
  });

  it('uses the WHITE Apple button style in the dark theme', async (): Promise<void> => {
    mockTheme = 'dark';
    await render(<LoginForm />);

    expect(mockApple.props?.buttonStyle).toBe(0);
  });

  it('shows the Apple button above Google in login and sign-up modes', async (): Promise<void> => {
    const screen = await render(<LoginForm />);

    for (const mode of ['login', 'signup']) {
      if (mode === 'signup') await fireEvent.press(screen.getByRole('button', { name: 'Sign Up' }));
      const buttons = screen.getAllByRole('button');
      const apple = buttons.indexOf(screen.getByRole('button', { name: 'Continue with Apple' }));
      const google = buttons.indexOf(screen.getByRole('button', { name: 'Continue with Google' }));
      expect(apple).toBeGreaterThanOrEqual(0);
      expect(google).toBeGreaterThan(apple);
    }
  });

  it('shows neither sign-in button when Apple is unavailable on iOS', async (): Promise<void> => {
    mockOptions.showApple = false;
    mockOptions.showGoogle = false;
    const screen = await render(<LoginForm />);

    expect(screen.queryByRole('button', { name: 'Continue with Apple' })).toBeNull();
    expect(screen.queryByTestId('google-icon')).toBeNull();
    expect(screen.getByLabelText('Email')).toBeTruthy();
  });

  it('sends the Apple credential to appleLogin, then clears the pending name', async (): Promise<void> => {
    const screen = await render(<LoginForm />);

    await fireEvent.press(screen.getByRole('button', { name: 'Continue with Apple' }));

    await waitFor(() => {
      expect(mockAppleLogin).toHaveBeenCalledWith(APPLE_DTO);
    });
    await waitFor(() => {
      expect(mockClearPendingAppleName).toHaveBeenCalledTimes(1);
    });
  });

  it('ignores a cancelled Apple sheet', async (): Promise<void> => {
    mockGetAppleSignInCredential.mockRejectedValue(new Error('cancelled'));
    mockIsAppleSignInCancelled.mockReturnValue(true);
    const screen = await render(<LoginForm />);

    await fireEvent.press(screen.getByRole('button', { name: 'Continue with Apple' }));

    await waitFor(() => {
      expect(mockIsAppleSignInCancelled).toHaveBeenCalled();
    });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(mockAppleLogin).not.toHaveBeenCalled();
  });

  it('shows an Apple failure in sign-up mode', async (): Promise<void> => {
    mockGetAppleSignInCredential.mockRejectedValue(new Error('Apple is down'));
    const screen = await render(<LoginForm />);
    await fireEvent.press(screen.getByRole('button', { name: 'Sign Up' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Continue with Apple' }));

    expect((await screen.findByRole('alert')).props.children).toBe('Apple is down');
  });

  it('shows a Google failure in sign-up mode', async (): Promise<void> => {
    mockGetGoogleFirebaseIdToken.mockRejectedValue(new Error('Google is down'));
    const screen = await render(<LoginForm />);
    await fireEvent.press(screen.getByRole('button', { name: 'Sign Up' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' }));

    expect((await screen.findByRole('alert')).props.children).toBe('Google is down');
  });

  it('starts one Apple sign-in for a double tap', async (): Promise<void> => {
    mockGetAppleSignInCredential.mockReturnValue(new Promise<unknown>((): void => {}));
    await render(<LoginForm />);
    const press = mockApple.press as () => Promise<void>;

    await act(async (): Promise<void> => {
      void press();
      void press();
    });

    expect(mockGetAppleSignInCredential).toHaveBeenCalledTimes(1);
  });

  it('replaces an Apple failure with a later email login failure', async (): Promise<void> => {
    mockGetAppleSignInCredential.mockRejectedValue(new Error('Apple is down'));
    const screen = await render(<LoginForm />);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue with Apple' }));
    expect(await screen.findByText('Apple is down')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Email'), 'user@example.com');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'password123');
    await fireEvent.press(screen.getByRole('button', { name: 'Log In' }));

    expect(await screen.findByText('Bad login')).toBeTruthy();
    expect(screen.queryByText('Apple is down')).toBeNull();
  });

  it('clears an Apple failure when a Google attempt starts', async (): Promise<void> => {
    mockGetAppleSignInCredential.mockRejectedValue(new Error('Apple is down'));
    mockGetGoogleFirebaseIdToken.mockRejectedValue(new Error('Google is down'));
    const screen = await render(<LoginForm />);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue with Apple' }));
    expect(await screen.findByText('Apple is down')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' }));

    expect(await screen.findByText('Google is down')).toBeTruthy();
    expect(screen.queryByText('Apple is down')).toBeNull();
  });
});
