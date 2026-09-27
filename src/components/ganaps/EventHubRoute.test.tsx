// Tests for src/app/(app)/(home)/event-hub/[ganap-id].tsx live here rather than
// beside it: any .test.tsx under src/app/ is picked up by Expo Router as a route.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { UseQueryResult } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Pressable as MockPressable, Text as MockText, View as MockView, Share } from 'react-native';
import type { EventHubViewProps } from '@/components/ganaps/EventHubView';
import { Routes } from '@/constants/routes';
import type { FriendGoingRecord } from '@/types/friends.types';
import type {
  FormBlock,
  FormBlockScope,
  GanapAnnouncement,
  GanapDetail,
  RegistrationStatus,
} from '@/types/ganap.types';
import { type GanapScheduleModel, getGanapScheduleModel } from '@/utils/ganap-detail';

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
const mockFriendsGoingRefetch = jest.fn<() => Promise<unknown>>().mockResolvedValue(undefined);
const mockFetchNextPage = jest.fn<() => Promise<unknown>>().mockResolvedValue(undefined);
const mockEventHubView = jest.fn<(props: EventHubViewProps) => ReactElement>();
interface TestShareModalProps {
  visible: boolean;
  url: string;
  ganap: GanapDetail;
  schedule: GanapScheduleModel;
  onClose: () => void;
  onNativeShare: () => void | Promise<void>;
}
const mockShareModal = jest.fn<(props: TestShareModalProps) => ReactElement>();
const mockBuildGanapShareUrl = jest.fn<(id: string) => string>(
  (id: string): string => `https://ganapps.example/ganaps/${id}`,
);
const mockShowToast = jest.fn<(type: 'error', title: string) => string>().mockReturnValue('toast');

type FormBlocksQueryState = Pick<UseQueryResult<FormBlock[], Error>, 'data' | 'isLoading' | 'error'>;
type UseFormBlocksQueryMock = (ganapId: string, scope: FormBlockScope) => FormBlocksQueryState;

let mockFormBlocksState: FormBlocksQueryState;
const mockUseFormBlocksQuery = jest.fn<UseFormBlocksQueryMock>(
  (_ganapId: string, _scope: FormBlockScope): FormBlocksQueryState => mockFormBlocksState,
);

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

const postAttendanceBlock: FormBlock = {
  id: 'post_attendance_block_1',
  ganapId: 'g1',
  scope: 'POST_ATTENDANCE',
  type: 'TEXT',
  label: 'What did you think?',
  isRequired: true,
  allowMultiple: false,
  order: 0,
  config: null,
  options: [],
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

const mockRegistrationBase = {
  id: 'registration_1',
  createdAt: '2026-08-01T00:00:00.000Z',
  registrationFormSubmittedAt: null,
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

let mockFriendsGoingState: {
  going: FriendGoingRecord[];
  isLoading: boolean;
  error: Error | null;
  hasNextPage: boolean;
  refetch: typeof mockFriendsGoingRefetch;
};

const mockUseFriendGoingQuery = jest.fn(
  (_enabled: boolean, _ganapId?: string): typeof mockFriendsGoingState => mockFriendsGoingState,
);

const mockUseGanapAnnouncements = jest.fn(
  (_ganapId: string, _isEligible: boolean): typeof mockAnnouncementsState => mockAnnouncementsState,
);

interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
}

/**
 * Creates a manually resolvable promise so a route callback can be observed in flight.
 *
 * @returns The promise and its resolver.
 */
function createDeferred(): Deferred {
  let resolvePromise: (() => void) | undefined;
  const promise = new Promise<void>((resolve: () => void): void => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve: (): void => resolvePromise?.(),
  };
}

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

jest.mock('@/components/ganaps/GanapShareModal', () => ({
  GanapShareModal: (props: TestShareModalProps): ReactElement => mockShareModal(props),
}));

jest.mock('@/utils/share-links', () => ({
  buildGanapShareUrl: (id: string): string => mockBuildGanapShareUrl(id),
}));

jest.mock('@/store/toast.store', () => ({
  showToast: (type: 'error', title: string): string => mockShowToast(type, title),
}));

jest.mock('@/hooks/queries/useGanapsQuery', () => ({
  useGanapDetailQuery: (): typeof mockDetailState => mockDetailState,
  useFormBlocksQuery: (ganapId: string, scope: FormBlockScope): FormBlocksQueryState =>
    mockUseFormBlocksQuery(ganapId, scope),
}));

jest.mock('@/hooks/queries/useFriendsQuery', () => ({
  useFriendGoingQuery: (enabled: boolean, ganapId?: string): typeof mockFriendsGoingState =>
    mockUseFriendGoingQuery(enabled, ganapId),
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

function latestShareModalProps(): TestShareModalProps {
  const props = mockShareModal.mock.calls.at(-1)?.[0];
  if (!props) throw new Error('GanapShareModal was never rendered');
  return props;
}

function resetStates(): void {
  mockBuildGanapShareUrl.mockImplementation((id: string): string => `https://ganapps.example/ganaps/${id}`);
  mockShareModal.mockImplementation((): ReactElement => <MockView />);
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
  mockFriendsGoingState = {
    going: [
      {
        id: 'registration_friend_1',
        createdAt: '2026-08-02T00:00:00.000Z',
        user: {
          userId: 'friend_1',
          username: 'ana.cruz',
          displayName: 'Ana Cruz',
          displayPicture: null,
        },
        ganap: {
          ganapId: 'g1',
          title: 'Coffee & Code',
          startDate: '2026-08-08T02:00:00.000Z',
          endDate: '2026-08-08T05:00:00.000Z',
          status: 'GOING',
        },
      },
    ],
    isLoading: false,
    error: null,
    hasNextPage: false,
    refetch: mockFriendsGoingRefetch,
  };
  mockFormBlocksState = {
    data: [],
    isLoading: false,
    error: null,
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
    expect(mockUseFormBlocksQuery).not.toHaveBeenCalled();
    expect(mockUseFriendGoingQuery).not.toHaveBeenCalled();
  });

  it('renders a retryable error when detail fails', async (): Promise<void> => {
    mockDetailState.error = new Error('Unable to load event');

    const screen = await renderRoute();
    await fireEvent.press(screen.getByRole('button', { name: 'Try Again' }));

    expect(screen.getByText('Unable to load event')).toBeTruthy();
    expect(mockDetailRefetch).toHaveBeenCalledTimes(1);
    expect(mockUseGanapAnnouncements).not.toHaveBeenCalled();
    expect(mockUseFormBlocksQuery).not.toHaveBeenCalled();
  });

  it('reports a missing Ganap as not found', async (): Promise<void> => {
    mockDetailState.data = undefined;

    const screen = await renderRoute();

    expect(screen.getByText('Event not found')).toBeTruthy();
    expect(mockUseGanapAnnouncements).not.toHaveBeenCalled();
    expect(mockUseFormBlocksQuery).not.toHaveBeenCalled();
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
    expect(mockUseFormBlocksQuery).not.toHaveBeenCalled();
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
    expect(mockUseFriendGoingQuery).toHaveBeenCalledWith(true, 'g1');
    expect(mockEventHubView).toHaveBeenCalled();
    expect(mockUseFormBlocksQuery).toHaveBeenCalledWith('g1', 'POST_ATTENDANCE');
  });
});

describe('Event Hub route loaded behavior', (): void => {
  it('does not mount the share QR modal before sharing is requested', async (): Promise<void> => {
    await renderRoute();

    expect(mockShareModal).not.toHaveBeenCalled();
  });

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
    expect(props.friendsGoing).toEqual([mockFriendsGoingState.going[0]?.user]);
    expect(props.isFriendsGoingLoading).toBe(false);
    expect(props.friendsGoingError).toBeNull();
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

  it('opens the QR card and includes its canonical URL in native sharing', async (): Promise<void> => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    const screen = await renderRoute();

    await fireEvent.press(screen.getByRole('button', { name: 'Hub share' }));

    const modalProps = latestShareModalProps();
    expect(mockBuildGanapShareUrl).toHaveBeenCalledWith('g1');
    expect(modalProps.visible).toBe(true);
    expect(modalProps.url).toBe('https://ganapps.example/ganaps/g1');
    expect(modalProps.ganap).toBe(mockGanap);

    await act(async (): Promise<void> => {
      await modalProps.onNativeShare();
    });

    const schedule = getGanapScheduleModel(mockGanap.startDate, mockGanap.endDate);
    expect(share).toHaveBeenCalledWith({
      message: `Coffee & Code\n${schedule.dateLabel} · ${schedule.timeLabel}\nStudent Union\nhttps://ganapps.example/ganaps/g1`,
      title: 'Coffee & Code',
    });
  });

  it('shows a graceful error when the public share URL cannot be built', async (): Promise<void> => {
    mockBuildGanapShareUrl.mockImplementation((): string => {
      throw new Error('EXPO_PUBLIC_WEB_URL is invalid');
    });
    const screen = await renderRoute();

    await fireEvent.press(screen.getByRole('button', { name: 'Hub share' }));

    expect(mockShareModal).not.toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith('error', 'Unable to create a share link.');
  });

  it('wires announcement retry and load-more to the aggregate hook', async (): Promise<void> => {
    const screen = await renderRoute();

    await fireEvent.press(screen.getByRole('button', { name: 'Hub retry announcements' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Hub retry next page' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Hub load more' }));

    expect(mockAnnouncementsRefetch).toHaveBeenCalledTimes(1);
    expect(mockFetchNextPage).toHaveBeenCalledTimes(2);
  });

  it('refreshes detail and announcements from one pull gesture', async (): Promise<void> => {
    const detailRefresh = createDeferred();
    const announcementsRefresh = createDeferred();
    const refetchDetail = jest.fn<() => Promise<unknown>>((): Promise<unknown> => detailRefresh.promise);
    const refetchAnnouncements = jest.fn<() => Promise<unknown>>((): Promise<unknown> => announcementsRefresh.promise);
    mockDetailState.refetch = refetchDetail;
    mockAnnouncementsState.refetch = refetchAnnouncements;

    await renderRoute();

    let refresh: Promise<void> | undefined;
    await act(async (): Promise<void> => {
      refresh = latestViewProps().onRefresh();
      await Promise.resolve();
    });

    await waitFor((): void => {
      expect(refetchDetail).toHaveBeenCalledTimes(1);
      expect(refetchAnnouncements).toHaveBeenCalledTimes(1);
      expect(mockFriendsGoingRefetch).toHaveBeenCalledTimes(1);
      expect(latestViewProps().isRefreshing).toBe(true);
    });

    await act(async (): Promise<void> => {
      detailRefresh.resolve();
      announcementsRefresh.resolve();
      await refresh;
    });

    await waitFor((): void => expect(latestViewProps().isRefreshing).toBe(false));
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

describe('Event Hub route feedback state', (): void => {
  it('shows actionable feedback when an attended Ganap has no form and no rating', async (): Promise<void> => {
    mockDetailState.data = {
      ...mockGanap,
      myRating: null,
      myRegistration: {
        ...mockRegistrationBase,
        status: 'ATTENDED',
        postAttendanceFormSubmittedAt: null,
      },
    };
    mockFormBlocksState = { data: [], isLoading: false, error: null };

    await renderRoute();

    expect(latestViewProps().feedbackState).toEqual({ kind: 'actionable' });
    expect(mockUseFormBlocksQuery).toHaveBeenCalledWith('g1', 'POST_ATTENDANCE');
  });

  it('shows submitted feedback when an attended Ganap has complete rating and form metadata', async (): Promise<void> => {
    mockDetailState.data = {
      ...mockGanap,
      myRating: 5,
      myRegistration: {
        ...mockRegistrationBase,
        status: 'ATTENDED',
        postAttendanceFormSubmittedAt: '2026-08-29T04:00:00.000Z',
      },
    };
    mockFormBlocksState = { data: [postAttendanceBlock], isLoading: false, error: null };

    await renderRoute();

    expect(latestViewProps().feedbackState).toEqual({ kind: 'submitted' });
  });

  it.each([
    { label: 'loading', state: { data: undefined, isLoading: true, error: null } },
    { label: 'error', state: { data: undefined, isLoading: false, error: new Error('Form metadata unavailable') } },
  ] satisfies Array<{
    label: string;
    state: FormBlocksQueryState;
  }>)('hides feedback while form metadata is $label', async ({
    state,
  }: {
    state: FormBlocksQueryState;
  }): Promise<void> => {
    mockDetailState.data = {
      ...mockGanap,
      myRating: null,
      myRegistration: {
        ...mockRegistrationBase,
        status: 'ATTENDED',
        postAttendanceFormSubmittedAt: null,
      },
    };
    mockFormBlocksState = state;

    await renderRoute();

    expect(latestViewProps().feedbackState).toEqual({ kind: 'hidden' });
  });

  it('keeps a form metadata error isolated from the announcement error surface', async (): Promise<void> => {
    const announcementError: Error = new Error('Announcements unavailable');
    mockDetailState.data = {
      ...mockGanap,
      myRating: null,
      myRegistration: {
        ...mockRegistrationBase,
        status: 'ATTENDED',
        postAttendanceFormSubmittedAt: null,
      },
    };
    mockAnnouncementsState.announcements = [];
    mockAnnouncementsState.total = 0;
    mockAnnouncementsState.error = announcementError;
    mockFormBlocksState = {
      data: undefined,
      isLoading: false,
      error: new Error('Form metadata unavailable'),
    };

    await renderRoute();

    expect(latestViewProps().announcementError).toBe(announcementError);
    expect(latestViewProps().feedbackState).toEqual({ kind: 'hidden' });
  });

  it('hides feedback for a registration that is not attended', async (): Promise<void> => {
    mockDetailState.data = {
      ...mockGanap,
      myRating: null,
      myRegistration: {
        ...mockRegistrationBase,
        status: 'REGISTERED',
        postAttendanceFormSubmittedAt: null,
      },
    };
    mockFormBlocksState = { data: [], isLoading: false, error: null };

    await renderRoute();

    expect(latestViewProps().feedbackState).toEqual({ kind: 'hidden' });
  });

  it('hides cached-complete feedback when announcement access is lost', async (): Promise<void> => {
    mockDetailState.data = {
      ...mockGanap,
      myRating: 5,
      myRegistration: {
        ...mockRegistrationBase,
        status: 'ATTENDED',
        postAttendanceFormSubmittedAt: '2026-08-29T04:00:00.000Z',
      },
    };
    mockFormBlocksState = { data: [postAttendanceBlock], isLoading: false, error: null };
    mockAnnouncementsState.hasLostAccess = true;

    await renderRoute();

    expect(latestViewProps().feedbackState).toEqual({ kind: 'hidden' });
  });
});
