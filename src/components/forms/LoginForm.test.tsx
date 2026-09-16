import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
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

jest.mock('@/hooks/useAuth', () => ({
  useAuth: (): Record<string, unknown> => ({
    login: async (): Promise<void> => {},
    register: async (): Promise<void> => {},
    googleLogin: async (): Promise<void> => {},
    isLoading: false,
    loginMutation: { error: null, isPending: false, reset: (): void => {} },
    registerMutation: { error: null, isPending: false, reset: (): void => {} },
    googleLoginMutation: { error: null, isPending: false, reset: (): void => {} },
  }),
}));

jest.mock('@/hooks/useFeatureFlag', () => ({
  useFeatureFlag: (): boolean => true,
}));

jest.mock('@/hooks/useResolvedTheme', () => ({
  useResolvedTheme: (): 'light' => 'light',
}));

jest.mock('@/services/google-auth.service', () => ({
  getGoogleFirebaseIdToken: async (): Promise<string> => 'test-token',
  isGoogleSignInCancelled: (): boolean => false,
}));

import { LoginForm } from './LoginForm';

describe('LoginForm Google sign-in icon', (): void => {
  it('renders the Google glyph in both login and sign-up modes', async (): Promise<void> => {
    const screen = await render(<LoginForm />);

    expect(screen.getByTestId('google-icon').props.children).toBe('google:20');

    fireEvent.press(screen.getByRole('button', { name: 'Sign Up' }));

    expect(screen.getByTestId('google-icon').props.children).toBe('google:20');
  });
});
