import { describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { View } from 'react-native';
import ProfileLayout from '@/app/(app)/(profile)/_layout';
import JoinedGanapsScreen from '@/app/(app)/(profile)/joined';
import { BAR_HEIGHT } from '@/components/navigation/AppTabBar';
import { Spacing } from '@/constants/theme';
import type { UseJoinedGanapsResult } from '@/hooks/useJoinedGanaps';
import type { JoinedGanap } from '@/types/profile.types';

const mockRouter = {
  push: jest.fn<(href: unknown) => void>(),
};

const MockView: typeof View = View;

const mockJoinedGanap: JoinedGanap = {
  id: 'ganap_1',
  businessId: 'business_1',
  businessName: 'CPU Developers',
  slug: 'cpu-developers-meetup',
  title: 'CPU Developers Meetup',
  startDate: '2026-08-08T02:00:00.000Z',
  endDate: '2026-08-08T04:00:00.000Z',
  status: 'PUBLISHED',
  tags: ['study'],
  coverImage: null,
  registrationStatus: 'REGISTERED',
  registeredAt: '2026-08-01T00:00:00.000Z',
};

const mockJoinedGanapsResult: UseJoinedGanapsResult = {
  items: [mockJoinedGanap],
  total: 1,
  isLoading: false,
  error: null,
  hasNextPage: false,
  fetchNextPage: jest.fn<UseJoinedGanapsResult['fetchNextPage']>(),
  isFetchingNextPage: false,
  isRefetching: false,
  refetch: jest.fn<UseJoinedGanapsResult['refetch']>(),
};

const mockUseJoinedGanaps = jest.fn<(take: number) => UseJoinedGanapsResult>(() => mockJoinedGanapsResult);

interface MockStackScreenProps {
  name?: string;
  options?: {
    title?: string;
    headerShown?: boolean;
  };
}

interface MockStackProps {
  children?: ReactNode;
}

jest.mock('expo-router', () => ({
  Stack: Object.assign(({ children }: MockStackProps): ReactElement => <>{children}</>, {
    Screen: ({ name, options }: MockStackScreenProps): ReactElement => (
      <MockView testID={`stack-screen-${name ?? ''}`} accessibilityLabel={options?.title} />
    ),
  }),
  useRouter: (): typeof mockRouter => mockRouter,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: (): { top: number; bottom: number; left: number; right: number } => ({
    top: 24,
    bottom: 10,
    left: 0,
    right: 0,
  }),
}));

jest.mock('@/hooks/useJoinedGanaps', () => ({
  useJoinedGanaps: (take: number): UseJoinedGanapsResult => mockUseJoinedGanaps(take),
}));

jest.mock('lucide-react-native', () => ({
  Calendar: (): null => null,
  CheckCircle2: (): null => null,
  ChevronRight: (): null => null,
  Clock: (): null => null,
}));

describe('JoinedGanaps profile route layout contract', (): void => {
  it('does not add status-bar inset below the native Joined Events header', async (): Promise<void> => {
    const screen = await render(<JoinedGanapsScreen />);

    const list = screen.getByTestId('joined-ganaps-list');
    expect(list.props.contentContainerStyle.paddingTop).toBe(Spacing.md);
    expect(list.props.contentContainerStyle.paddingTop).not.toBe(24 + Spacing.md);
    expect(list.props.contentContainerStyle.paddingBottom).toBe(10 + BAR_HEIGHT + Spacing.xs);
  });

  it('keeps the Joined Events title on the profile native stack header', (): void => {
    const layout: ReactElement = ProfileLayout();
    if (!isValidElement<{ children?: ReactNode }>(layout)) {
      throw new Error('Profile layout did not return a React element');
    }

    const joinedScreen: ReactElement<MockStackScreenProps> | undefined = Children.toArray(layout.props.children).find(
      (child: ReactNode): child is ReactElement<MockStackScreenProps> =>
        isValidElement<MockStackScreenProps>(child) && child.props.name === 'joined',
    );

    expect(joinedScreen?.props.options).toEqual({ title: 'Joined Events' });
  });
});
