import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { Pressable, Text } from 'react-native';
import FriendProfileScreen from '@/app/(app)/(chat)/friend-profile/[user-id]';
import type { FriendProfile } from '@/types/friends.types';

const mockRouter = { back: jest.fn<() => void>(), push: jest.fn<(href: unknown) => void>() };
const MockPressable: typeof Pressable = Pressable;
const MockText: typeof Text = Text;
const mockRefetch = jest.fn<() => Promise<unknown>>().mockResolvedValue(undefined);
let mockQuery: { data?: FriendProfile; error: Error | null; isLoading: boolean; refetch: typeof mockRefetch };

jest.mock('expo-router', () => ({
  useRouter: (): typeof mockRouter => mockRouter,
  useLocalSearchParams: (): { 'user-id': string } => ({ 'user-id': 'friend-1' }),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: ReactNode }): ReactElement => <>{children}</>,
  useSafeAreaInsets: (): { top: number; bottom: number; left: number; right: number } => ({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  }),
}));
jest.mock('@/hooks/queries/useFriendsQuery', () => ({ useFriendProfileQuery: (): typeof mockQuery => mockQuery }));
jest.mock('@/hooks/mutations/useFriendsMutation', () => ({
  useUnfriendMutation: (): { isPending: boolean } => ({ isPending: false }),
}));
jest.mock('@/hooks/mutations/useModerationMutation', () => ({
  useBlockUserMutation: (): { isPending: boolean } => ({ isPending: false }),
}));
jest.mock('@/components/common/IconButton', () => ({
  IconButton: ({
    children,
    accessibilityLabel,
    onPress,
  }: {
    children: ReactNode;
    accessibilityLabel: string;
    onPress: () => void;
  }): ReactElement => (
    <MockPressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress}>
      {children}
    </MockPressable>
  ),
}));
jest.mock('@/components/common/Loading', () => ({
  Loading: ({ message }: { message: string }): ReactElement => <MockText>{message}</MockText>,
}));
jest.mock('lucide-react-native', () => ({
  ArrowLeft: (): null => null,
  Ban: (): null => null,
  MessageCircle: (): null => null,
  UserMinus: (): null => null,
}));

describe('FriendProfileScreen', (): void => {
  it('keeps back available while loading and after a failed request', async (): Promise<void> => {
    mockQuery = { isLoading: true, error: null, refetch: mockRefetch };
    const screen = await render(<FriendProfileScreen />);
    await fireEvent.press(screen.getByLabelText('Go back'));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Loading profile')).toBeTruthy();

    mockQuery = { isLoading: false, error: new Error('Profile unavailable'), refetch: mockRefetch };
    await screen.rerender(<FriendProfileScreen />);
    expect(screen.getByLabelText('Go back')).toBeTruthy();
    await fireEvent.press(screen.getByText('Try Again'));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });
});
