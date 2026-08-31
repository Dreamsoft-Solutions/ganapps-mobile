// Tests for src/app/(app)/(home)/[ganap-id].tsx live here rather than beside
// the route: Expo Router would otherwise treat the test as a screen.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { View as MockView } from 'react-native';
import type { GanapDetail } from '@/types/ganap.types';

const mockParams: { 'ganap-id': string } = { 'ganap-id': 'ganap_1' };
const mockRouter = {
  back: jest.fn<() => void>(),
  push: jest.fn<(href: unknown) => void>(),
};
const mockDetailRefetch = jest.fn<() => Promise<unknown>>().mockResolvedValue(undefined);
const mockEventDetailView = jest.fn<(props: Record<string, unknown>) => ReactElement>();

const ganap: GanapDetail = {
  id: 'ganap_1',
  businessId: 'business_1',
  businessName: 'Ganapps Demo Business',
  slug: 'test-event',
  title: 'Test Event',
  description: 'A test event.',
  address: 'Student Union',
  locationLat: 10.7313,
  locationLong: 122.5489,
  startDate: '2026-08-08T02:00:00.000Z',
  endDate: '2026-08-08T06:00:00.000Z',
  attendanceOpenMinutesBefore: 30,
  status: 'PUBLISHED',
  requiresApproval: false,
  maxAttendees: 40,
  tags: ['test'],
  coverImage: null,
  bannerImage: null,
  mapPinImage: null,
  registrationCount: 0,
  likesCount: 0,
  averageRating: null,
  ratingCount: 0,
  isLiked: false,
  isSaved: false,
  myRegistration: null,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

let mockDetailState: {
  data: GanapDetail | undefined;
  isLoading: boolean;
  error: Error | null;
  isRefetching: boolean;
  refetch: typeof mockDetailRefetch;
};

jest.mock('expo-router', () => ({
  useLocalSearchParams: (): typeof mockParams => mockParams,
  useRouter: (): typeof mockRouter => mockRouter,
}));

jest.mock('@/components/ganaps/EventDetailView', () => ({
  EventDetailView: (props: Record<string, unknown>): ReactElement => mockEventDetailView(props),
}));

jest.mock('@/components/common/Error', () => ({
  ErrorView: (): ReactElement => <MockView />,
}));

jest.mock('@/components/common/Loading', () => ({
  Loading: (): ReactElement => <MockView />,
}));

jest.mock('@/hooks/queries/useGanapsQuery', () => ({
  useGanapDetailQuery: (): typeof mockDetailState => mockDetailState,
}));

jest.mock('@/hooks/queries/useBusinessesQuery', () => ({
  useBusinessDetailQuery: (): { data: undefined } => ({ data: undefined }),
}));

jest.mock('@/hooks/useGanaps', () => ({
  useGanaps: (): {
    join: () => Promise<{ requiresForm: boolean }>;
    leave: () => Promise<void>;
    toggleLike: () => Promise<void>;
    toggleSave: () => Promise<void>;
    isJoining: boolean;
    isLeaving: boolean;
    isTogglingLike: boolean;
    isTogglingSave: boolean;
  } => ({
    join: async (): Promise<{ requiresForm: boolean }> => ({ requiresForm: false }),
    leave: async (): Promise<void> => {},
    toggleLike: async (): Promise<void> => {},
    toggleSave: async (): Promise<void> => {},
    isJoining: false,
    isLeaving: false,
    isTogglingLike: false,
    isTogglingSave: false,
  }),
}));

import GanapDetailScreen from '@/app/(app)/(home)/[ganap-id]';

/**
 * Returns the most recently rendered Event Details view props.
 *
 * @returns Event Details view props.
 */
function latestViewProps(): Record<string, unknown> {
  const props = mockEventDetailView.mock.calls.at(-1)?.[0];
  if (!props) throw new Error('EventDetailView was never rendered');
  return props;
}

function resetState(): void {
  mockDetailState = {
    data: ganap,
    isLoading: false,
    error: null,
    isRefetching: false,
    refetch: mockDetailRefetch,
  };
  mockEventDetailView.mockImplementation((): ReactElement => <MockView testID="event-detail-view" />);
}

beforeEach((): void => {
  resetState();
});

afterEach((): void => {
  jest.clearAllMocks();
  resetState();
});

describe('Event Details route refresh', (): void => {
  it('passes detail refetch and isRefetching to the pull-to-refresh view contract', async (): Promise<void> => {
    mockDetailState.isRefetching = true;

    await render(<GanapDetailScreen />);

    const props = latestViewProps();
    const onRefresh = props.onRefresh as (() => Promise<void>) | undefined;

    expect(props.isRefreshing).toBe(true);
    expect(onRefresh).toBeDefined();
    await onRefresh?.();
    expect(mockDetailRefetch).toHaveBeenCalledTimes(1);
  });
});
