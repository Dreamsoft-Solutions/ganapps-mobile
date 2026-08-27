// Tests for src/app/(app)/(home)/event-hub/[ganap-id].tsx live here rather than
// beside it: any .test.tsx under src/app/ is picked up by Expo Router as a route.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Pressable as MockPressable, Text as MockText, View as MockView, Share } from 'react-native';
import type { EventHubViewProps } from '@/components/ganaps/EventHubView';
import { Routes } from '@/constants/routes';
import type { GanapAnnouncement, GanapDetail, RegistrationStatus } from '@/types/ganap.types';
import { getGanapScheduleModel } from '@/utils/ganap-detail';

const mockRouter = {
  back: jest.fn<() => void>(),
  canDismiss: jest.fn<() => boolean>(),
  dismiss: jest.fn<() => void>(),
  push: jest.fn<(href: unknown) => void>(),
  replace: jest.fn<(href: unknown) => void>(),
};
const mockParams: { 'ganap-id': string } = { 'ganap-id': 'g1' };

const mockDetailRefetch = jest.fn<() => Promise<unknown>>().mockResolvedValue(undefined);
const mockAnnouncementsRefetch = jest.fn<() => Promise<unknown>>().mockResolvedValue(undefined);
const mockFetchNextPage = jest.fn<() => Promise<unknown>>().mockResolvedValue(undefined);
const mockEventHubView = jest.fn<(props: EventHubViewProps) => ReactElement>();

const announcement: GanapAnnouncement = {
  id: 'announcement_1',
  ganapId: 'g1',
  createdByUserId: 'user_1',
  createdByUsername: 'Miguel Santos',
  type: 'UPDATE',
  title: 'Venue update',
  content: 'Meet by the main entrance.',
  createdAt: '2026-08-04T01:00:00.000Z',
};

const mockGanap: GanapDetail = {
  id: 'g1',
  businessId: 'b1',
  businessName: 'CPU Developers',
  slug: 'coffee-and-code',
  title: 'Coffee & Code',
  description: 'Bring a laptop.',
  address: 'Student Union',
  locationLat: 10.7313,
  locationLong: 122.5489,
  startDate: '2026-08-08T02:00:00.000Z',
  endDate: '2026-08-08T05:00:00.000Z',
  attendanceOpenMinutesBefore: 30,
  status: 'PUBLISHED',
  requiresApproval: false,
  maxAttendees: 20,
  tags: ['study'],
  coverImage: null,
  bannerImage: null,
  mapPinImage: null,
  registrationCount: 17,
  likesCount: 0,
  averageRating: null,
  ratingCount: 0,
  isLiked: false,
  isSaved: false,
  myRegistration: {
    id: 'registration_1',
    status: 'REGISTERED',
    createdAt: '2026-08-01T00:00:00.000Z',
    registrationFormSubmittedAt: null,
  },
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

let mockDetailState: {
  data: GanapDetail | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: typeof mockDetailRefetch;
};

let mockAnnouncementsState: {
  announcements: GanapAnnouncement[];
  total: number;
  isLoading: boolean;
  error: Error | null;
  refetch: typeof mockAnnouncementsRefetch;
  fetchNextPage: typeof mockFetchNextPage;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  hasLostAccess: boolean;
};

const mockUseGanapAnnouncements = jest.fn(
  (_ganapId: string, _isEligible: boolean): typeof mockAnnouncementsState => mockAnnouncementsState,
);

jest.mock('expo-router', () => ({
  useLocalSearchParams: (): typeof mockParams => mockParams,
  useRouter: (): typeof mockRouter => mockRouter,
}));

jest.mock('lucide-react-native', () => {
  const React = require('react') as typeof import('react');
  return {
    LucideProvider: ({ children }: { children: React.ReactNode }): React.ReactElement =>
      React.createElement(React.Fragment, null, children),
  };
});

jest.mock('@/components/common/Error', () => ({
  ErrorView: ({ error, onRetry }: { error: Error | null; onRetry?: () => void }): ReactElement => (
    <MockView>
      <MockText>{error?.message}</MockText>
      {onRetry && <MockPressable accessibilityRole="button" accessibilityLabel="Try Again" onPress={onRetry} />}
    </MockView>
  ),
}));

jest.mock('@/components/common/Loading', () => ({
  Loading: (): ReactElement => <MockText>Loading</MockText>,
}));

jest.mock('@/components/ganaps/EventHubView', () => ({
  EventHubView: (props: EventHubViewProps): ReactElement => mockEventHubView(props),
}));

jest.mock('@/hooks/queries/useGanapsQuery', () => ({
  useGanapDetailQuery: (): typeof mockDetailState => mockDetailState,
}));

jest.mock('@/hooks/useGanapAnnouncements', () => ({
  useGanapAnnouncements: (ganapId: string, isEligible: boolean): typeof mockAnnouncementsState =>
    mockUseGanapAnnouncements(ganapId, isEligible),
}));

import EventHubScreen from '@/app/(app)/(home)/event-hub/[ganap-id]';

/**
 * Renders the Event Hub route under test.
 *
 * @returns The rendered screen.
 */
async function renderRoute(): Promise<Awaited<ReturnType<typeof render>>> {
  return await render(<EventHubScreen />);
}

/**
 * Reads the props most recently passed to the mocked Event Hub view.
 *
 * @returns The latest Event Hub view props.
 */
function latestViewProps(): EventHubViewProps {
  const calls = mockEventHubView.mock.calls;
  const props = calls[calls.length - 1]?.[0];
  if (!props) throw new Error('EventHubView was never rendered');
  return props;
}

function resetStates(): void {
  mockDetailState = {
    data: mockGanap,
    isLoading: false,
    error: null,
    refetch: mockDetailRefetch,
  };
  mockAnnouncementsState = {
    announcements: [announcement],
    total: 21,
    isLoading: false,
    error: null,
    refetch: mockAnnouncementsRefetch,
    fetchNextPage: mockFetchNextPage,
    hasNextPage: true,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
    hasLostAccess: false,
  };
  mockEventHubView.mockImplementation(
    (props: EventHubViewProps): ReactElement => (
      <MockView>
        <MockText>{props.ganap.title}</MockText>
        <MockPressable accessibilityRole="button" accessibilityLabel="Hub back" onPress={props.onBack} />
        <MockPressable
          accessibilityRole="button"
          accessibilityLabel="Hub share"
          onPress={(): void => {
            void props.onShare();
          }}
        />
        <MockPressable
          accessibilityRole="button"
          accessibilityLabel="Hub retry announcements"
          onPress={(): void => {
            void props.onRetryAnnouncements();
          }}
        />
        <MockPressable
          accessibilityRole="button"
          accessibilityLabel="Hub retry next page"
          onPress={(): void => {
            void props.onRetryNextPage();
          }}
        />
        <MockPressable
          accessibilityRole="button"
          accessibilityLabel="Hub load more"
          onPress={(): void => {
            void props.onLoadMore();
          }}
        />
      </MockView>
    ),
  );
}

beforeEach((): void => {
  resetStates();
  mockRouter.canDismiss.mockReturnValue(false);
});

afterEach((): void => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  resetStates();
});

describe('Event Hub route detail states', (): void => {
  it('renders a full-screen loading state while detail loads', async (): Promise<void> => {
    mockDetailState.isLoading = true;

    const screen = await renderRoute();

    expect(screen.getByText('Loading')).toBeTruthy();
    expect(mockUseGanapAnnouncements).not.toHaveBeenCalled();
  });

  it('renders a retryable error when detail fails', async (): Promise<void> => {
    mockDetailState.error = new Error('Unable to load event');

    const screen = await renderRoute();
    await fireEvent.press(screen.getByRole('button', { name: 'Try Again' }));

    expect(screen.getByText('Unable to load event')).toBeTruthy();
    expect(mockDetailRefetch).toHaveBeenCalledTimes(1);
    expect(mockUseGanapAnnouncements).not.toHaveBeenCalled();
  });

  it('reports a missing Ganap as not found', async (): Promise<void> => {
    mockDetailState.data = undefined;

    const screen = await renderRoute();

    expect(screen.getByText('Event not found')).toBeTruthy();
    expect(mockUseGanapAnnouncements).not.toHaveBeenCalled();
  });
});

describe('Event Hub route eligibility guard', (): void => {
  const deniedStatuses: (RegistrationStatus | null)[] = [
    null,
    'PENDING',
    'WAITLISTED',
    'CANCELLED',
    'REJECTED',
    'EVICTED',
  ];

  it.each(
    deniedStatuses,
  )('denies %s and never mounts the announcement hook', async (status: RegistrationStatus | null): Promise<void> => {
    mockDetailState.data = {
      ...mockGanap,
      myRegistration: status
        ? { id: 'registration_1', status, createdAt: '2026-08-01T00:00:00.000Z', registrationFormSubmittedAt: null }
        : null,
    };

    const screen = await renderRoute();

    expect(screen.getByText('Event Hub is for joined students')).toBeTruthy();
    expect(mockUseGanapAnnouncements).not.toHaveBeenCalled();
    expect(mockEventHubView).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Back to Event Details' }));

    expect(mockRouter.replace).toHaveBeenCalledWith(Routes.ganapDetail('g1'));
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it.each<RegistrationStatus>([
    'REGISTERED',
    'ATTENDED',
  ])('mounts the announcement hook with eligibility for %s', async (status: RegistrationStatus): Promise<void> => {
    mockDetailState.data = {
      ...mockGanap,
      myRegistration: {
        id: 'registration_1',
        status,
        createdAt: '2026-08-01T00:00:00.000Z',
        registrationFormSubmittedAt: null,
      },
    };

    await renderRoute();

    expect(mockUseGanapAnnouncements).toHaveBeenCalledWith('g1', true);
    expect(mockEventHubView).toHaveBeenCalled();
  });
});

describe('Event Hub route loaded behavior', (): void => {
  it('passes the real Ganap, derived schedule, and paging state to the view', async (): Promise<void> => {
    await renderRoute();

    const props = latestViewProps();

    expect(props.ganap).toBe(mockGanap);
    expect(props.schedule).toEqual(getGanapScheduleModel(mockGanap.startDate, mockGanap.endDate));
    expect(props.announcements).toEqual([announcement]);
    expect(props.total).toBe(21);
    expect(props.hasNextPage).toBe(true);
    expect(props.isFetchingNextPage).toBe(false);
    expect(props.isFetchNextPageError).toBe(false);
    expect(props.accessLost).toBe(false);
  });

  it('returns to the same Event Details route rather than an untrusted history entry', async (): Promise<void> => {
    mockRouter.canDismiss.mockReturnValue(true);

    const screen = await renderRoute();

    await fireEvent.press(screen.getByRole('button', { name: 'Hub back' }));

    expect(mockRouter.dismiss).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('replaces the route for a direct Hub entry with no dismissible history', async (): Promise<void> => {
    const screen = await renderRoute();

    await fireEvent.press(screen.getByRole('button', { name: 'Hub back' }));

    expect(mockRouter.replace).toHaveBeenCalledWith(Routes.ganapDetail('g1'));
    expect(mockRouter.dismiss).not.toHaveBeenCalled();
  });

  it('shares real Ganap data through the native share sheet', async (): Promise<void> => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    const screen = await renderRoute();

    await fireEvent.press(screen.getByRole('button', { name: 'Hub share' }));

    const schedule = getGanapScheduleModel(mockGanap.startDate, mockGanap.endDate);
    expect(share).toHaveBeenCalledWith({
      message: `Coffee & Code\n${schedule.dateLabel} · ${schedule.timeLabel}\nStudent Union`,
      title: 'Coffee & Code',
    });
  });

  it('wires announcement retry and load-more to the aggregate hook', async (): Promise<void> => {
    const screen = await renderRoute();

    await fireEvent.press(screen.getByRole('button', { name: 'Hub retry announcements' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Hub retry next page' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Hub load more' }));

    expect(mockAnnouncementsRefetch).toHaveBeenCalledTimes(1);
    expect(mockFetchNextPage).toHaveBeenCalledTimes(2);
  });
});

describe('Event Hub route access loss', (): void => {
  it('clears announcements when access is lost before the first page loads', async (): Promise<void> => {
    mockAnnouncementsState.announcements = [];
    mockAnnouncementsState.total = 0;
    mockAnnouncementsState.error = new Error('Forbidden');
    mockAnnouncementsState.hasLostAccess = true;

    await renderRoute();

    const props = latestViewProps();

    expect(props.accessLost).toBe(true);
    expect(props.announcements).toEqual([]);
  });

  it('drops cached announcements when access is lost after pages were loaded', async (): Promise<void> => {
    mockAnnouncementsState.announcements = [announcement];
    mockAnnouncementsState.total = 21;
    mockAnnouncementsState.error = new Error('Forbidden');
    mockAnnouncementsState.isFetchNextPageError = true;
    mockAnnouncementsState.hasLostAccess = true;

    await renderRoute();

    const props = latestViewProps();

    expect(props.accessLost).toBe(true);
    expect(props.announcements).toEqual([]);
    expect(props.total).toBe(0);
    expect(props.hasNextPage).toBe(false);
    expect(props.isFetchNextPageError).toBe(false);
  });

  it('keeps a non-403 announcement error retryable inside the hub', async (): Promise<void> => {
    const error: Error = new Error('Network request failed');
    mockAnnouncementsState.announcements = [];
    mockAnnouncementsState.total = 0;
    mockAnnouncementsState.error = error;
    mockAnnouncementsState.hasLostAccess = false;

    const screen = await renderRoute();

    expect(latestViewProps().announcementError).toBe(error);
    expect(latestViewProps().accessLost).toBe(false);

    await fireEvent.press(screen.getByRole('button', { name: 'Hub retry announcements' }));

    expect(mockAnnouncementsRefetch).toHaveBeenCalledTimes(1);
  });
});
