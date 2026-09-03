import { describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { DeleteAccountFlow, type DeleteAccountFlowProps } from './DeleteAccountFlow';

jest.mock('lucide-react-native', () => ({
  LucideProvider: ({ children }: { children: ReactNode }): ReactElement => <>{children}</>,
}));

jest.mock('@/hooks/useResolvedTheme', () => ({
  useResolvedTheme: (): 'light' => 'light',
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: (): { top: number; right: number; bottom: number; left: number } => ({
    top: 0,
    right: 0,
    bottom: 12,
    left: 0,
  }),
}));

function codedError(errorCode: string, message: string): Error & { errorCode: string } {
  return Object.assign(new Error(message), { errorCode });
}

function defaultProps(): DeleteAccountFlowProps {
  return {
    visible: true,
    isDeleting: false,
    error: null,
    onClose: jest.fn<() => void>(),
    onDelete: jest.fn<DeleteAccountFlowProps['onDelete']>().mockResolvedValue(undefined),
  };
}

describe('DeleteAccountFlow', (): void => {
  it('discloses the irreversible consequences before the typed confirmation', async (): Promise<void> => {
    const screen = await render(<DeleteAccountFlow {...defaultProps()} />);

    expect(screen.getByText('Delete your account?')).toBeTruthy();
    expect(screen.getByText(/profile, friendships, registrations, saved Ganaps, and messages/)).toBeTruthy();
    expect(screen.getByText('Signing out alone does not delete your account.')).toBeTruthy();
    expect(screen.queryByTestId('delete-account-confirmation-input')).toBeNull();
  });

  it('requires the exact phrase after trimming and sends the trimmed phrase', async (): Promise<void> => {
    const props: DeleteAccountFlowProps = defaultProps();
    const screen = await render(<DeleteAccountFlow {...props} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    const finalButton = screen.getByRole('button', { name: 'Delete account permanently' });
    const input = screen.getByTestId('delete-account-confirmation-input');

    expect(finalButton.props.accessibilityState).toMatchObject({ disabled: true, busy: false });
    await fireEvent.changeText(input, 'DELETE MY ACCOUN');
    expect(finalButton.props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText(/Enter the exact phrase DELETE MY ACCOUNT/)).toBeTruthy();

    await fireEvent.changeText(input, ' DELETE MY ACCOUNT ');
    expect(screen.getByRole('button', { name: 'Delete account permanently' }).props.accessibilityState.disabled).toBe(
      false,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Delete account permanently' }));

    await waitFor((): void => {
      expect(props.onDelete).toHaveBeenCalledWith('DELETE MY ACCOUNT');
    });
  });

  it('exposes a busy disabled destructive action while deleting', async (): Promise<void> => {
    const props: DeleteAccountFlowProps = { ...defaultProps(), isDeleting: true };
    const screen = await render(<DeleteAccountFlow {...props} />);

    expect(screen.getByRole('button', { name: 'Continue' }).props.accessibilityState).toMatchObject({
      disabled: true,
      busy: false,
    });
  });

  it('submits only once when the destructive action is tapped twice while pending', async (): Promise<void> => {
    let resolveDeletion: (() => void) | undefined;
    const pendingDeletion: Promise<void> = new Promise<void>((resolve: () => void): void => {
      resolveDeletion = resolve;
    });
    const onDelete = jest.fn<DeleteAccountFlowProps['onDelete']>().mockReturnValue(pendingDeletion);
    const screen = await render(<DeleteAccountFlow {...defaultProps()} onDelete={onDelete} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    await fireEvent.changeText(screen.getByTestId('delete-account-confirmation-input'), 'DELETE MY ACCOUNT');
    const finalButton = screen.getByRole('button', { name: 'Delete account permanently' });
    const click = finalButton.props.onClick as () => void;

    await act(async (): Promise<void> => {
      click();
      click();
      expect(onDelete).toHaveBeenCalledTimes(1);
      resolveDeletion?.();
      await pendingDeletion;
    });
    expect(finalButton.props.accessibilityState.busy).toBe(false);
  });

  it('keeps the typed phrase and allows an explicit retry after a network failure', async (): Promise<void> => {
    const props: DeleteAccountFlowProps = {
      ...defaultProps(),
      onDelete: jest.fn<DeleteAccountFlowProps['onDelete']>().mockRejectedValue(new Error('transport unavailable')),
    };
    const screen = await render(<DeleteAccountFlow {...props} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    const input = screen.getByTestId('delete-account-confirmation-input');
    await fireEvent.changeText(input, 'DELETE MY ACCOUNT');
    await fireEvent.press(screen.getByRole('button', { name: 'Delete account permanently' }));

    await screen.rerender(
      <DeleteAccountFlow {...props} error={codedError('NETWORK_ERROR', 'transport unavailable')} />,
    );

    expect(screen.getByTestId('delete-account-confirmation-input').props.value).toBe('DELETE MY ACCOUNT');
    expect(screen.getByText("We couldn't confirm account deletion. Check your connection and try again.")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Delete account permanently' }));
    expect(props.onDelete).toHaveBeenCalledTimes(2);
  });

  it('renders the typed SuperAdmin refusal without changing the confirmation state', async (): Promise<void> => {
    const screen = await render(
      <DeleteAccountFlow
        {...defaultProps()}
        error={codedError('SUPERADMIN_ACCOUNT_CANNOT_BE_DELETED', 'protected role')}
      />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('This account cannot be deleted.')).toBeTruthy();
    expect(screen.getByTestId('delete-account-confirmation-input')).toBeTruthy();
  });
});
