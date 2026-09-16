import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import SettingsScreen from '@/app/(app)/(profile)/settings';
import VerifyEmailScreen from '@/app/verify-email';
import type { DeleteAccountInput } from '@/types/auth.types';

interface MockDeleteAccountMutation {
  error: Error | null;
  isPending: boolean;
  reset: () => void;
}

interface MockAuthResult {
  deleteAccount: (input: DeleteAccountInput) => Promise<void>;
  deleteAccountMutation: MockDeleteAccountMutation;
  resendVerification: () => Promise<void>;
  resendVerificationMutation: { isPending: boolean };
}

interface MockBlockedUsersQuery {
  blockedUsers: [];
  error: Error | null;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isLoading: boolean;
  fetchNextPage: () => Promise<unknown>;
  refetch: () => Promise<unknown>;
}

interface MockUnblockMutation {
  error: Error | null;
  isPending: boolean;
  mutateAsync: (input: { userId: string }) => Promise<void>;
  variables?: { userId: string };
}

interface MockThemeState {
  mode: 'light' | 'dark' | 'system';
  setMode: (mode: MockThemeState['mode']) => Promise<void>;
}

const mockDeleteAccountMutation: MockDeleteAccountMutation = {
  error: null,
  isPending: false,
  reset: jest.fn<() => void>(),
};
const mockAuth: MockAuthResult = {
  deleteAccount: jest.fn<MockAuthResult['deleteAccount']>().mockResolvedValue(undefined),
  deleteAccountMutation: mockDeleteAccountMutation,
  resendVerification: jest.fn<MockAuthResult['resendVerification']>().mockResolvedValue(undefined),
  resendVerificationMutation: { isPending: false },
};

const mockBlockedUsersQuery: MockBlockedUsersQuery = {
  blockedUsers: [],
  error: null,
  hasNextPage: false,
  isFetchingNextPage: false,
  isLoading: false,
  fetchNextPage: jest.fn<MockBlockedUsersQuery['fetchNextPage']>().mockResolvedValue(undefined),
  refetch: jest.fn<MockBlockedUsersQuery['refetch']>().mockResolvedValue(undefined),
};

const mockUnblockMutation: MockUnblockMutation = {
  error: null,
  isPending: false,
  mutateAsync: jest.fn<MockUnblockMutation['mutateAsync']>().mockResolvedValue(undefined),
};

function mockUseAuth(): MockAuthResult {
  return mockAuth;
}

function mockUseThemeStore(selector: (state: MockThemeState) => unknown): unknown {
  return selector({ mode: 'system', setMode: jest.fn<MockThemeState['setMode']>().mockResolvedValue(undefined) });
}

jest.mock('@/hooks/useAuth', () => ({ useAuth: mockUseAuth }));
jest.mock('@/hooks/queries/useModerationQuery', () => ({
  useBlockedUsersQuery: (): MockBlockedUsersQuery => mockBlockedUsersQuery,
}));
jest.mock('@/hooks/mutations/useModerationMutation', () => ({
  useUnblockUserMutation: (): MockUnblockMutation => mockUnblockMutation,
}));
jest.mock('@/store/theme.store', () => ({ useThemeStore: mockUseThemeStore }));
jest.mock('@/hooks/useResolvedTheme', () => ({ useResolvedTheme: (): 'light' => 'light' }));
jest.mock('@/components/forms/VerifyEmailForm', () => ({
  VerifyEmailForm: (): null => null,
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: ReactNode }): ReactElement => <>{children}</>,
  useSafeAreaInsets: (): { top: number; right: number; bottom: number; left: number } => ({
    top: 0,
    right: 0,
    bottom: 12,
    left: 0,
  }),
}));
jest.mock('lucide-react-native', () => ({
  Check: (): null => null,
  LucideProvider: ({ children }: { children: ReactNode }): ReactElement => <>{children}</>,
  Monitor: (): null => null,
  Moon: (): null => null,
  Sun: (): null => null,
}));

beforeEach((): void => {
  mockDeleteAccountMutation.error = null;
  mockDeleteAccountMutation.isPending = false;
  mockDeleteAccountMutation.reset = jest.fn<() => void>();
  mockUnblockMutation.error = null;
  mockUnblockMutation.isPending = false;
  mockUnblockMutation.variables = undefined;
});

describe('account deletion entry points', (): void => {
  it('makes Delete account discoverable from Settings and opens the shared flow', async (): Promise<void> => {
    const screen = await render(<SettingsScreen />);
    const entry = screen.getByRole('button', { name: 'Delete account' });

    expect(entry).toBeTruthy();
    await fireEvent.press(entry);

    expect(mockDeleteAccountMutation.reset).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Delete your account?')).toBeTruthy();
  });

  it('makes Delete account discoverable for an authenticated unverified User on Verify Email', async (): Promise<void> => {
    const screen = await render(<VerifyEmailScreen />);
    const entry = screen.getByRole('button', { name: 'Delete account' });

    expect(entry).toBeTruthy();
    await fireEvent.press(entry);

    expect(mockDeleteAccountMutation.reset).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Delete your account?')).toBeTruthy();
  });
});
