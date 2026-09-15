import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { showToast } from '@/store/toast.store';
import { LegalLinks } from './LegalLinks';

jest.mock('lucide-react-native', (): object => ({
  LucideProvider: ({ children }: { children: import('react').ReactNode }): import('react').ReactNode => children,
}));

jest.mock('@/store/toast.store', (): object => ({ showToast: jest.fn() }));

describe('LegalLinks', (): void => {
  afterEach((): void => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    delete process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL;
    delete process.env.EXPO_PUBLIC_ACCOUNT_DELETION_URL;
  });

  it('opens privacy and deletion resources without claiming an account was deleted', async (): Promise<void> => {
    process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL = 'https://ganapps.test/privacy';
    process.env.EXPO_PUBLIC_ACCOUNT_DELETION_URL = 'https://ganapps.test/delete-account';
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await render(<LegalLinks includeDeletion />);
    await fireEvent.press(screen.getByText('Privacy Policy'));
    await waitFor((): void => expect(open).toHaveBeenCalledWith('https://ganapps.test/privacy'));
    await fireEvent.press(screen.getByText('Delete account'));
    await waitFor((): void => expect(open).toHaveBeenCalledWith('https://ganapps.test/delete-account'));
    expect(showToast).not.toHaveBeenCalled();
  });

  it('reports missing links and browser failures', async (): Promise<void> => {
    const open = jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('No browser'));
    await render(<LegalLinks />);
    expect(screen.queryByText('Delete account')).toBeNull();
    await fireEvent.press(screen.getByText('Privacy Policy'));
    await waitFor((): void => expect(showToast).toHaveBeenCalledTimes(1));
    expect(open).not.toHaveBeenCalled();
    process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL = 'https://ganapps.test/privacy';
    await fireEvent.press(screen.getByText('Privacy Policy'));
    await waitFor((): void => expect(showToast).toHaveBeenCalledTimes(2));
  });
});
