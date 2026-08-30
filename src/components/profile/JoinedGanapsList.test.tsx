import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import type { UseJoinedGanapsResult } from '@/hooks/useJoinedGanaps';
import type { JoinedGanap, JoinedGanapFilters } from '@/types/profile.types';
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

const mockUseJoinedGanaps = jest.fn<(take: number, filters?: JoinedGanapFilters) => UseJoinedGanapsResult>(
  () => mockJoinedGanapsResult,
);

const emptyStateCases: Array<[JoinedGanapFilters, string]> = [
  [{}, 'You have not joined any events yet.'],
  [{ time: 'UPCOMING' }, 'No upcoming events.'],
  [{ time: 'PAST' }, 'No events match your filters.'],
  [{ search: 'missing', time: 'UPCOMING' }, 'No events match your filters.'],
];

const paginationCases: Array<[boolean, boolean, number]> = [
  [true, false, 1],
  [false, false, 0],
  [true, true, 0],
];

afterEach((): void => {
  mockUseJoinedGanaps.mockImplementation(() => mockJoinedGanapsResult);
  jest.clearAllMocks();
});

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
  useJoinedGanaps: (take: number, filters?: JoinedGanapFilters): UseJoinedGanapsResult =>
    mockUseJoinedGanaps(take, filters),
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
      flexGrow: 1,
    });
  });
});

describe('JoinedGanapsList states', (): void => {
  it.each(emptyStateCases)('uses the correct empty copy for filters %j', async (filters, message): Promise<void> => {
    mockUseJoinedGanaps.mockReturnValue({
      ...mockJoinedGanapsResult,
      items: [],
      total: 0,
    });

    const screen = await render(<JoinedGanapsList contentTopPadding={8} contentBottomPadding={90} filters={filters} />);

    expect(screen.getByText(message)).toBeTruthy();
  });

  it('renders the initial loading state with its message', async (): Promise<void> => {
    mockUseJoinedGanaps.mockReturnValue({
      ...mockJoinedGanapsResult,
      items: [],
      isLoading: true,
    });

    const screen = await render(<JoinedGanapsList contentTopPadding={8} contentBottomPadding={90} />);

    expect(screen.getByText('Loading joined events...')).toBeTruthy();
    expect(screen.queryByTestId('joined-ganaps-list')).toBeNull();
  });

  it('renders an error state whose retry action refetches joined Ganaps', async (): Promise<void> => {
    const refetch = jest.fn<UseJoinedGanapsResult['refetch']>();
    mockUseJoinedGanaps.mockReturnValue({
      ...mockJoinedGanapsResult,
      error: new Error('Request failed'),
      refetch,
    });

    const screen = await render(<JoinedGanapsList contentTopPadding={8} contentBottomPadding={90} />);

    expect(screen.getByText('Request failed')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Try Again' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('keeps pull-to-refresh and incremental page loading separate', async (): Promise<void> => {
    const refetch = jest.fn<UseJoinedGanapsResult['refetch']>();
    const fetchNextPage = jest.fn<UseJoinedGanapsResult['fetchNextPage']>();
    mockUseJoinedGanaps.mockReturnValue({
      ...mockJoinedGanapsResult,
      total: 2,
      hasNextPage: true,
      fetchNextPage,
      isFetchingNextPage: true,
      isRefetching: true,
      refetch,
    });

    const screen = await render(
      <JoinedGanapsList contentTopPadding={8} contentBottomPadding={90} filters={{ time: 'UPCOMING' }} />,
    );
    const list = screen.getByTestId('joined-ganaps-list');

    expect(list.props.refreshControl.props.refreshing).toBe(true);
    await fireEvent(list, 'onRefresh');
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('joined-ganaps-incremental-loading')).toBeTruthy();
    await fireEvent(list, 'onEndReached');
    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it.each(
    paginationCases,
  )('fetches another page only when hasNextPage=%s and isFetchingNextPage=%s', async (hasNextPage, isFetchingNextPage, callCount): Promise<void> => {
    const fetchNextPage = jest.fn<UseJoinedGanapsResult['fetchNextPage']>();
    mockUseJoinedGanaps.mockReturnValue({
      ...mockJoinedGanapsResult,
      hasNextPage,
      fetchNextPage,
      isFetchingNextPage,
    });

    const screen = await render(<JoinedGanapsList contentTopPadding={8} contentBottomPadding={90} />);
    await fireEvent(screen.getByTestId('joined-ganaps-list'), 'onEndReached');

    expect(fetchNextPage).toHaveBeenCalledTimes(callCount);
  });
});
