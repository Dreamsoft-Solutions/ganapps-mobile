import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import type { UseSavedGanapsResult } from '@/hooks/useSavedGanaps';
import type { SavedGanap } from '@/types/profile.types';
import { SavedGanapsList } from './SavedGanapsList';

const mockRouter = {
  push: jest.fn<(href: unknown) => void>(),
};

const mockToggleSave = jest.fn<(variables: { ganapId: string; isSaved: boolean }) => Promise<void>>(
  async (): Promise<void> => undefined,
);

const mockSavedGanap: SavedGanap = {
  id: 'ganap_1',
  businessId: 'business_1',
  businessName: 'CPU Developers',
  slug: 'cpu-developers-meetup',
  title: 'CPU Developers Meetup',
  startDate: '2026-09-30T02:00:00.000Z',
  endDate: null,
  status: 'PUBLISHED',
  tags: ['study'],
  coverImage: null,
  savedAt: '2026-09-01T00:00:00.000Z',
};

const mockSavedGanapsResult: UseSavedGanapsResult = {
  items: [mockSavedGanap],
  total: 1,
  isLoading: false,
  error: null,
  hasNextPage: false,
  fetchNextPage: jest.fn<UseSavedGanapsResult['fetchNextPage']>(),
  isFetchingNextPage: false,
  isRefetching: false,
  refetch: jest.fn<UseSavedGanapsResult['refetch']>(),
};

const mockUseSavedGanaps = jest.fn<(take: number) => UseSavedGanapsResult>(() => mockSavedGanapsResult);

afterEach((): void => {
  mockUseSavedGanaps.mockImplementation(() => mockSavedGanapsResult);
  jest.clearAllMocks();
});

jest.mock('expo-router', () => ({
  useRouter: (): typeof mockRouter => mockRouter,
}));

jest.mock('@/hooks/useSavedGanaps', () => ({
  useSavedGanaps: (take: number): UseSavedGanapsResult => mockUseSavedGanaps(take),
}));

jest.mock('@/hooks/useGanaps', () => ({
  useGanaps: (): { toggleSave: typeof mockToggleSave } => ({ toggleSave: mockToggleSave }),
}));

jest.mock('lucide-react-native', () => ({
  Bookmark: (): null => null,
  Calendar: (): null => null,
  Clock: (): null => null,
}));

describe('SavedGanapsList layout contract', (): void => {
  it('uses explicit route-owned padding and never adds a second top inset', async (): Promise<void> => {
    const screen = await render(<SavedGanapsList contentTopPadding={16} contentBottomPadding={96} />);

    expect(screen.getByTestId('saved-ganaps-list').props.contentContainerStyle).toEqual({
      paddingTop: 16,
      paddingBottom: 96,
      flexGrow: 1,
    });
  });

  it('requests one page of twenty', async (): Promise<void> => {
    await render(<SavedGanapsList contentTopPadding={0} contentBottomPadding={0} />);

    expect(mockUseSavedGanaps).toHaveBeenCalledWith(20);
  });
});

describe('SavedGanapsList states', (): void => {
  it('renders a saved event', async (): Promise<void> => {
    const screen = await render(<SavedGanapsList contentTopPadding={0} contentBottomPadding={0} />);

    expect(screen.getByText('CPU Developers Meetup')).toBeTruthy();
  });

  it('tells the user nothing is saved yet', async (): Promise<void> => {
    mockUseSavedGanaps.mockReturnValue({ ...mockSavedGanapsResult, items: [], total: 0 });

    const screen = await render(<SavedGanapsList contentTopPadding={0} contentBottomPadding={0} />);

    expect(screen.getByText('You have not saved any events yet.')).toBeTruthy();
  });

  it('renders a loading message while the first page is in flight', async (): Promise<void> => {
    mockUseSavedGanaps.mockReturnValue({ ...mockSavedGanapsResult, items: [], isLoading: true });

    const screen = await render(<SavedGanapsList contentTopPadding={0} contentBottomPadding={0} />);

    expect(screen.getByText('Loading saved events...')).toBeTruthy();
    expect(screen.queryByTestId('saved-ganaps-list')).toBeNull();
  });

  it('renders a retryable error', async (): Promise<void> => {
    const refetch = jest.fn<UseSavedGanapsResult['refetch']>();
    mockUseSavedGanaps.mockReturnValue({
      ...mockSavedGanapsResult,
      error: new Error('Network unavailable'),
      refetch,
    });

    const screen = await render(<SavedGanapsList contentTopPadding={0} contentBottomPadding={0} />);
    fireEvent.press(screen.getByRole('button', { name: 'Try Again' }));

    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe('SavedGanapsList interactions', (): void => {
  it('opens the event detail when a row is pressed', async (): Promise<void> => {
    const screen = await render(<SavedGanapsList contentTopPadding={0} contentBottomPadding={0} />);

    fireEvent.press(screen.getByRole('button', { name: 'CPU Developers Meetup' }));

    expect(mockRouter.push).toHaveBeenCalledTimes(1);
  });

  it('unsaves the row through the save mutation', async (): Promise<void> => {
    const screen = await render(<SavedGanapsList contentTopPadding={0} contentBottomPadding={0} />);

    fireEvent.press(screen.getByRole('button', { name: 'Remove CPU Developers Meetup from saved events' }));

    expect(mockToggleSave).toHaveBeenCalledWith({ ganapId: 'ganap_1', isSaved: true });
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('pages when the list end is reached', async (): Promise<void> => {
    const fetchNextPage = jest.fn<UseSavedGanapsResult['fetchNextPage']>();
    mockUseSavedGanaps.mockReturnValue({ ...mockSavedGanapsResult, hasNextPage: true, fetchNextPage });

    const screen = await render(<SavedGanapsList contentTopPadding={0} contentBottomPadding={0} />);
    fireEvent(screen.getByTestId('saved-ganaps-list'), 'onEndReached');

    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('does not page again while a page is already loading', async (): Promise<void> => {
    const fetchNextPage = jest.fn<UseSavedGanapsResult['fetchNextPage']>();
    mockUseSavedGanaps.mockReturnValue({
      ...mockSavedGanapsResult,
      hasNextPage: true,
      isFetchingNextPage: true,
      fetchNextPage,
    });

    const screen = await render(<SavedGanapsList contentTopPadding={0} contentBottomPadding={0} />);
    fireEvent(screen.getByTestId('saved-ganaps-list'), 'onEndReached');

    expect(fetchNextPage).not.toHaveBeenCalled();
  });
});
