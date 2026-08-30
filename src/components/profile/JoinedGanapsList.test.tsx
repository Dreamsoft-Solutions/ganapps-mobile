import { describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import type { UseJoinedGanapsResult } from '@/hooks/useJoinedGanaps';
import type { JoinedGanap } from '@/types/profile.types';
import { JoinedGanapsList } from './JoinedGanapsList';

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
  isRefetching: false,
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

describe('JoinedGanapsList layout contract', (): void => {
  it('uses explicit route-owned padding and never adds a second top inset', async (): Promise<void> => {
    const screen = await render(<JoinedGanapsList contentTopPadding={16} contentBottomPadding={96} />);

    const list = screen.getByTestId('joined-ganaps-list');
    expect(list.props.contentContainerStyle).toEqual({
      paddingTop: 16,
      paddingBottom: 96,
    });
  });
});
