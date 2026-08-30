import { describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { BAR_HEIGHT } from '@/components/navigation/AppTabBar';
import { Spacing } from '@/constants/theme';
import type { UseJoinedGanapsResult } from '@/hooks/useJoinedGanaps';
import type { JoinedGanap } from '@/types/profile.types';
import GanapsScreen from './ganaps';

const mockRouter = {
  push: jest.fn<(href: unknown) => void>(),
};

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
  refetch: jest.fn<UseJoinedGanapsResult['refetch']>(),
};

const mockUseJoinedGanaps = jest.fn<(take: number) => UseJoinedGanapsResult>(() => mockJoinedGanapsResult);

jest.mock('expo-router', () => ({
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

describe('GanapsScreen layout contract', (): void => {
  it('renders the My Events heading below the status-bar inset', async (): Promise<void> => {
    const screen = await render(<GanapsScreen />);

    expect(screen.getByRole('header', { name: 'My Events' })).toBeTruthy();
    const headingContainer = screen.getByTestId('my-events-heading-container');
    expect(headingContainer.props.style).toEqual({ paddingTop: 24 + Spacing.md });

    const list = screen.getByTestId('joined-ganaps-list');
    expect(list.props.contentContainerStyle).toMatchObject({
      paddingTop: Spacing.md,
      paddingBottom: 10 + BAR_HEIGHT + Spacing.xs,
    });
  });
});
