import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import type { DeleteAccountInput } from '@/types/auth.types';
import { DeleteAccountForm } from './DeleteAccountForm';

jest.setTimeout(30_000);

const mockDeleteAccount = jest.fn<(input: DeleteAccountInput) => Promise<void>>();
const mockDeleteAccountMutation: { isPending: boolean; error: Error | null; reset: () => void } = {
  isPending: false,
  error: null,
  reset: jest.fn<() => void>(),
};

const mockAuth: {
  deleteAccount: typeof mockDeleteAccount;
  deleteAccountMutation: typeof mockDeleteAccountMutation;
} = {
  deleteAccount: mockDeleteAccount,
  deleteAccountMutation: mockDeleteAccountMutation,
};

function mockUseAuth(): typeof mockAuth {
  return mockAuth;
}

jest.mock('@/hooks/useAuth', () => ({ useAuth: mockUseAuth }));
jest.mock('@/hooks/useResolvedTheme', () => ({ useResolvedTheme: (): 'light' => 'light' }));
jest.mock('react-native/Libraries/Modal/Modal', () => {
  const React = require('react') as typeof import('react');

  function MockModal({ visible, children }: { visible: boolean; children: ReactNode }): ReactElement | null {
    return visible ? React.createElement(React.Fragment, null, children) : null;
  }

  return { __esModule: true, default: MockModal };
});
jest.mock('react-native/Libraries/Components/Keyboard/KeyboardAvoidingView', () => {
  const React = require('react') as typeof import('react');

  function MockKeyboardAvoidingView({ children }: { children: ReactNode }): ReactElement {
    return React.createElement(React.Fragment, null, children);
  }

  return { __esModule: true, default: MockKeyboardAvoidingView };
});
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: ReactNode }): ReactElement => <>{children}</>,
}));
jest.mock('lucide-react-native', () => ({
  LucideProvider: ({ children }: { children: ReactNode }): ReactElement => <>{children}</>,
}));

async function openConfirmation(
  screen: Awaited<ReturnType<typeof render>>,
): Promise<ReturnType<typeof screen.getByRole>> {
  await fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));
  await waitFor((): void => expect(screen.getByText('Delete your account?')).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  return screen.getByRole('button', { name: 'Delete account permanently' });
}

async function waitForSubmissionToFinish(screen: Awaited<ReturnType<typeof render>>): Promise<void> {
  await waitFor((): void => {
    expect(screen.getByRole('button', { name: 'Delete account permanently' }).props.accessibilityState.busy).toBe(
      false,
    );
  });
}

beforeEach((): void => {
  mockDeleteAccount.mockReset().mockResolvedValue(undefined);
  mockDeleteAccountMutation.isPending = false;
  mockDeleteAccountMutation.error = null;
  mockDeleteAccountMutation.reset = jest.fn<() => void>();
});

describe('DeleteAccountForm', (): void => {
  it('discloses irreversible consequences before showing confirmation input', async (): Promise<void> => {
    const screen = await render(<DeleteAccountForm />);

    await fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));
    await waitFor((): void => expect(screen.getByText('Delete your account?')).toBeTruthy());
  });

  it('requires the exact trimmed phrase before submitting', async (): Promise<void> => {
    const screen = await render(<DeleteAccountForm />);
    const finalButton = await openConfirmation(screen);
    const input = screen.getByLabelText('Confirmation phrase');

    expect(finalButton.props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(input, 'DELETE MY ACCOUN');
    expect(finalButton.props.accessibilityState.disabled).toBe(true);

    await fireEvent.changeText(input, ' DELETE MY ACCOUNT ');
    await waitFor((): void => {
      expect(screen.getByRole('button', { name: 'Delete account permanently' }).props.accessibilityState.disabled).toBe(
        false,
      );
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Delete account permanently' }));

    await waitFor((): void => {
      expect(mockDeleteAccount).toHaveBeenCalledWith({
        confirmationPhrase: 'DELETE MY ACCOUNT',
        idempotencyKey: expect.any(String),
      });
    });
    await waitForSubmissionToFinish(screen);
  });

  it('ignores duplicate destructive presses while retaining one request key', async (): Promise<void> => {
    let resolveRequest: (() => void) | undefined;
    const pendingRequest: Promise<void> = new Promise<void>((resolve: () => void): void => {
      resolveRequest = resolve;
    });
    mockDeleteAccount.mockReturnValue(pendingRequest);
    const screen = await render(<DeleteAccountForm />);
    const finalButton = await openConfirmation(screen);
    await fireEvent.changeText(screen.getByLabelText('Confirmation phrase'), 'DELETE MY ACCOUNT');
    await waitFor((): void => {
      expect(screen.getByRole('button', { name: 'Delete account permanently' }).props.accessibilityState.disabled).toBe(
        false,
      );
    });

    const buttonProps = finalButton.props as { onPress?: unknown; onClick?: unknown };
    const candidate: unknown = buttonProps.onPress ?? buttonProps.onClick;
    if (typeof candidate !== 'function') throw new Error('Destructive button has no press handler.');
    const onPress: () => void | Promise<void> = candidate as () => void | Promise<void>;
    let presses: [Promise<void>, Promise<void>] | null = null;
    await act((): void => {
      presses = [
        Promise.resolve(onPress()).then((): void => undefined),
        Promise.resolve(onPress()).then((): void => undefined),
      ];
    });
    if (presses === null) throw new Error('Destructive presses were not started.');
    const pendingPresses: [Promise<void>, Promise<void>] = presses;
    await waitFor((): void => expect(mockDeleteAccount).toHaveBeenCalledTimes(1));
    expect(mockDeleteAccount.mock.calls[0]?.[0].idempotencyKey).toBeTruthy();
    await act(async (): Promise<void> => {
      resolveRequest?.();
      await Promise.all(pendingPresses);
    });
    await waitForSubmissionToFinish(screen);
  });

  it('keeps the phrase and allows a same-key retry after a transport failure', async (): Promise<void> => {
    mockDeleteAccount.mockRejectedValueOnce(new Error('transport unavailable')).mockResolvedValueOnce(undefined);
    const screen = await render(<DeleteAccountForm />);
    await openConfirmation(screen);
    const input = screen.getByLabelText('Confirmation phrase');
    await fireEvent.changeText(input, 'DELETE MY ACCOUNT');
    await waitFor((): void => {
      expect(screen.getByRole('button', { name: 'Delete account permanently' }).props.accessibilityState.disabled).toBe(
        false,
      );
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Delete account permanently' }));

    await waitFor((): void => expect(screen.getByText(/couldn't confirm account deletion/)).toBeTruthy());
    await waitForSubmissionToFinish(screen);
    expect(screen.getByLabelText('Confirmation phrase').props.value).toBe('DELETE MY ACCOUNT');
    const firstKey = mockDeleteAccount.mock.calls[0]?.[0].idempotencyKey;

    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    await waitFor((): void => expect(mockDeleteAccount).toHaveBeenCalledTimes(2));
    await waitForSubmissionToFinish(screen);
    expect(mockDeleteAccount.mock.calls[1]?.[0].idempotencyKey).toBe(firstKey);
  });

  it('resets step, phrase, error, and key after a non-pending cancel and reopen', async (): Promise<void> => {
    mockDeleteAccount.mockRejectedValueOnce(new Error('transport unavailable')).mockResolvedValueOnce(undefined);
    const screen = await render(<DeleteAccountForm />);
    await openConfirmation(screen);
    await fireEvent.changeText(screen.getByLabelText('Confirmation phrase'), 'DELETE MY ACCOUNT');
    await waitFor((): void => {
      expect(screen.getByRole('button', { name: 'Delete account permanently' }).props.accessibilityState.disabled).toBe(
        false,
      );
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Delete account permanently' }));
    await waitFor((): void => expect(screen.getByText(/couldn't confirm account deletion/)).toBeTruthy());
    await waitForSubmissionToFinish(screen);
    const firstKey = mockDeleteAccount.mock.calls[0]?.[0].idempotencyKey;

    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Delete your account?')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));
    expect(screen.queryByLabelText('Confirmation phrase')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByLabelText('Confirmation phrase').props.value).toBe('');
    expect(screen.queryByText(/couldn't confirm account deletion/)).toBeNull();

    await fireEvent.changeText(screen.getByLabelText('Confirmation phrase'), 'DELETE MY ACCOUNT');
    await waitFor((): void => {
      expect(screen.getByRole('button', { name: 'Delete account permanently' }).props.accessibilityState.disabled).toBe(
        false,
      );
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Delete account permanently' }));
    await waitFor((): void => expect(mockDeleteAccount).toHaveBeenCalledTimes(2));
    await waitForSubmissionToFinish(screen);
    expect(mockDeleteAccount.mock.calls[1]?.[0].idempotencyKey).not.toBe(firstKey);
  });

  it('exposes accessible labels and states for the destructive flow', async (): Promise<void> => {
    const screen = await render(<DeleteAccountForm />);

    expect(screen.getByRole('button', { name: 'Delete account' }).props.accessibilityHint).toContain('irreversible');
    await fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));
    await waitFor((): void => expect(screen.getByText('Delete your account?')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByLabelText('Confirmation phrase')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete account permanently' }).props.accessibilityHint).toContain(
      'Permanently',
    );
  });
});
