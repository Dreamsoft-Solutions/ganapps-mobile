import { describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render } from '@testing-library/react-native';
import GanapsScreen from '@/app/(app)/(ganaps)/ganaps';
import { BAR_HEIGHT } from '@/components/navigation/AppTabBar';
import { Spacing } from '@/constants/theme';
import type { UseJoinedGanapsResult } from '@/hooks/useJoinedGanaps';
import type { UseSavedGanapsResult } from '@/hooks/useSavedGanaps';
import type { JoinedGanap, JoinedGanapFilters } from '@/types/profile.types';

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

const mockSavedGanapsResult: UseSavedGanapsResult = {
  items: [],
  total: 0,
  isLoading: false,
  error: null,
  hasNextPage: false,
  fetchNextPage: jest.fn<UseSavedGanapsResult['fetchNextPage']>(),
  isFetchingNextPage: false,
  isRefetching: false,
  refetch: jest.fn<UseSavedGanapsResult['refetch']>(),
};

const mockToggleSave = jest.fn<(variables: { ganapId: string; isSaved: boolean }) => Promise<void>>(
  async (): Promise<void> => undefined,
);

const mockUseJoinedGanaps = jest.fn<(take: number, filters?: JoinedGanapFilters) => UseJoinedGanapsResult>(
  () => mockJoinedGanapsResult,
);

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

jest.mock('@/hooks/useSavedGanaps', () => ({
  useSavedGanaps: (): UseSavedGanapsResult => mockSavedGanapsResult,
}));

jest.mock('@/hooks/useGanaps', () => ({
  useGanaps: (): { toggleSave: typeof mockToggleSave } => ({ toggleSave: mockToggleSave }),
}));

jest.mock('lucide-react-native', () => ({
  Bookmark: (): null => null,
  Calendar: (): null => null,
  CheckCircle2: (): null => null,
  ChevronRight: (): null => null,
  Clock: (): null => null,
  Search: (): null => null,
  X: (): null => null,
}));

afterEach((): void => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

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

  it('publishes a trimmed search only after the 300 ms debounce', async (): Promise<void> => {
    jest.useFakeTimers();
    const screen = await render(<GanapsScreen />);
    const search = screen.getByLabelText('Search joined events');

    await fireEvent.changeText(search, '  Design  ');
    await act(async (): Promise<void> => {
      jest.advanceTimersByTime(299);
    });
    const beforeDebounce = mockUseJoinedGanaps.mock.calls[mockUseJoinedGanaps.mock.calls.length - 1]?.[1];
    expect(beforeDebounce).toEqual({ time: 'UPCOMING' });

    await act(async (): Promise<void> => {
      jest.advanceTimersByTime(1);
    });
    const afterDebounce = mockUseJoinedGanaps.mock.calls[mockUseJoinedGanaps.mock.calls.length - 1]?.[1];
    expect(afterDebounce).toEqual({ search: 'Design', time: 'UPCOMING' });
  });

  it('omits a whitespace-only search after the 300 ms debounce', async (): Promise<void> => {
    jest.useFakeTimers();
    const screen = await render(<GanapsScreen />);

    await fireEvent.changeText(screen.getByLabelText('Search joined events'), '   ');
    await act(async (): Promise<void> => {
      jest.advanceTimersByTime(300);
    });

    const filters = mockUseJoinedGanaps.mock.calls[mockUseJoinedGanaps.mock.calls.length - 1]?.[1];
    expect(filters).toEqual({ time: 'UPCOMING' });
  });
});

describe('GanapsScreen segments', (): void => {
  it('shows the joined filter bar by default and hides it on the saved segment', async (): Promise<void> => {
    const screen = await render(<GanapsScreen />);

    expect(screen.getByPlaceholderText('Search joined events')).toBeTruthy();
    expect(screen.getByTestId('joined-ganaps-list')).toBeTruthy();

    await act(async (): Promise<void> => {
      fireEvent.press(screen.getByRole('tab', { name: 'Saved' }));
    });

    expect(screen.queryByPlaceholderText('Search joined events')).toBeNull();
    expect(screen.getByTestId('saved-ganaps-list')).toBeTruthy();
    expect(screen.queryByTestId('joined-ganaps-list')).toBeNull();
  });

  it('returns to the joined list when the Joined segment is chosen again', async (): Promise<void> => {
    const screen = await render(<GanapsScreen />);

    await act(async (): Promise<void> => {
      fireEvent.press(screen.getByRole('tab', { name: 'Saved' }));
    });
    expect(screen.getByTestId('saved-ganaps-list')).toBeTruthy();

    await act(async (): Promise<void> => {
      fireEvent.press(screen.getByRole('tab', { name: 'Joined' }));
    });

    expect(screen.getByTestId('joined-ganaps-list')).toBeTruthy();
    expect(screen.queryByTestId('saved-ganaps-list')).toBeNull();
  });

  it('starts on the joined segment', async (): Promise<void> => {
    const screen = await render(<GanapsScreen />);

    expect(screen.getByRole('tab', { name: 'Joined' }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByRole('tab', { name: 'Saved' }).props.accessibilityState.selected).toBe(false);
  });
});
