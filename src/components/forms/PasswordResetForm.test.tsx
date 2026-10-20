import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { PasswordResetForm } from './PasswordResetForm';

jest.mock('lucide-react-native', () => {
  const React = require('react') as typeof import('react');
  return {
    CircleHelp: (): null => null,
    LucideProvider: ({ children }: { children?: ReactNode }): ReactElement =>
      React.createElement(React.Fragment, null, children),
  };
});
jest.mock('expo-router', () => ({ useRouter: (): { replace: () => void } => ({ replace: (): void => {} }) }));
jest.mock('@/hooks/useResolvedTheme', () => ({ useResolvedTheme: (): 'light' => 'light' }));
jest.mock('@/hooks/useAuth', () => ({
  useAuth: (): Record<string, unknown> => ({
    requestPasswordReset: async (): Promise<{ message: string }> => ({ message: 'Check your email.' }),
    completePasswordReset: async (): Promise<{ message: string }> => ({ message: 'Password reset.' }),
    requestPasswordResetMutation: { error: null, isPending: false, reset: (): void => {} },
    completePasswordResetMutation: { error: null, isPending: false, reset: (): void => {} },
  }),
}));

describe('PasswordResetForm', (): void => {
  it('keeps each typed reset-code digit while the incomplete code is invalid', async (): Promise<void> => {
    await render(<PasswordResetForm initialEmail="user@example.com" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Send Reset Code' }));

    const codeInput = await screen.findByLabelText('Reset code');
    await fireEvent.changeText(codeInput, '1');
    await waitFor((): void => expect(screen.getByLabelText('Reset code').props.value).toBe('1'));
    await fireEvent.changeText(codeInput, '12');
    await waitFor((): void => expect(screen.getByLabelText('Reset code').props.value).toBe('12'));
  });
});
