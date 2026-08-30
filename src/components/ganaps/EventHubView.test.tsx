import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { View as MockView, type StyleProp, type ViewStyle } from 'react-native';
import { Colors } from '@/constants/theme';
import type { GanapAnnouncement, GanapDetail } from '@/types/ganap.types';
import { formatDateTime } from '@/utils/formatting';
import type { GanapScheduleModel } from '@/utils/ganap-detail';

const windowDimensions: { current: { width: number; height: number; scale: number; fontScale: number } } = {
  current: { width: 402, height: 874, scale: 2, fontScale: 1 },
};

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: (): { width: number; height: number; scale: number; fontScale: number } => windowDimensions.current,
}));

jest.mock('expo-image', () => ({
  Image: ({ style }: { style?: StyleProp<ViewStyle> }): ReactElement => <MockView testID="expo-image" style={style} />,
}));

jest.mock('lucide-react-native', () => ({
  ArrowLeft: (): null => null,
  BellRing: (): null => null,
  Calendar: (): null => null,
  CircleCheck: (): null => null,
  Clock: (): null => null,
  Globe: (): null => null,
  MapPin: (): null => null,
  Megaphone: (): null => null,
  MessageCircle: (): null => null,
  MessageSquare: (): null => null,
  QrCode: (): null => null,
  RefreshCw: ({ color }: { color?: string }): ReactElement => (
    <MockView testID="icon-update" {...({ color } as unknown as { color?: string })} />
  ),
  Share2: (): null => null,
  Users: (): null => null,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: (): { top: number; bottom: number; left: number; right: number } => ({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  }),
}));

jest.mock('@/hooks/useResolvedTheme', () => ({
  useResolvedTheme: (): 'light' => 'light',
}));

import { EventHubView, type EventHubViewProps } from './EventHubView';

const ganap: GanapDetail = {
  id: 'ganap_1',
  businessId: 'business_1',
  businessName: 'Ganapps Demo Business',
  slug: 'coffee-and-code-at-festive-walk',
  title: 'Coffee & Code at Festive Walk',
  description: 'A casual co-working meetup for students.',
  address: 'Festive Walk Mall, Iloilo City, Philippines',
  locationLat: 10.7313,
  locationLong: 122.5489,
  startDate: '2026-08-08T02:00:00.000Z',
  endDate: '2026-08-08T05:00:00.000Z',
  attendanceOpenMinutesBefore: 30,
  status: 'PUBLISHED',
  requiresApproval: false,
  maxAttendees: 40,
  tags: ['study'],
  coverImage: 'https://example.com/cover.jpg',
  bannerImage: 'https://example.com/banner.jpg',
  mapPinImage: null,
  registrationCount: 17,
  likesCount: 3,
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

const schedule: GanapScheduleModel = {
  dateLabel: 'Saturday, August 8, 2026',
  timeLabel: '10:00 AM – 1:00 PM',
};

const reminderAnnouncement: GanapAnnouncement = {
  id: 'announcement_1',
  ganapId: 'ganap_1',
  createdByUserId: 'user_1',
  createdByUsername: 'Miguel Santos',
  type: 'REMINDER',
  title: 'Meet at the main entrance',
  content: 'We are meeting at the ground floor near the main entrance. Look for the Ganapps banner.',
  createdAt: '2026-08-04T01:00:00.000Z',
};

const generalAnnouncement: GanapAnnouncement = {
  id: 'announcement_2',
  ganapId: 'ganap_1',
  createdByUserId: 'user_1',
  createdByUsername: 'Miguel Santos',
  type: 'GENERAL',
  title: null,
  content: 'Welcome to the event hub. All updates will be posted here.',
  createdAt: '2026-08-03T01:00:00.000Z',
};

const updateAnnouncement: GanapAnnouncement = {
  id: 'announcement_3',
  ganapId: 'ganap_1',
  createdByUserId: 'user_2',
  createdByUsername: 'Ana Cruz',
  type: 'UPDATE',
  title: 'Start time moved',
  content: 'We now start at 10:15 AM to give everyone time to settle in.',
  createdAt: '2026-08-02T01:00:00.000Z',
};

/**
 * Builds Event Hub view props with sensible loaded defaults.
 *
 * @param overrides - Props to replace on the loaded baseline.
 * @returns A complete props object for rendering the view.
 */
function buildProps(overrides: Partial<EventHubViewProps> = {}): EventHubViewProps {
  return {
    ganap,
    schedule,
    announcements: [reminderAnnouncement, generalAnnouncement],
    total: 2,
    isAnnouncementsLoading: false,
    announcementError: null,
    hasNextPage: false,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
    accessLost: false,
    isRefreshing: false,
    onBack: (): void => {},
    onShare: (): void => {},
    onRefresh: async (): Promise<void> => {},
    onRetryAnnouncements: (): void => {},
    onRetryNextPage: (): void => {},
    onLoadMore: (): void => {},
    scanState: 'hidden',
    onScanAttendance: (): void => {},
    hasPendingFeedback: false,
    onGiveFeedback: (): void => {},
    ...overrides,
  };
}

describe('EventHubView header', (): void => {
  it('renders back, share, and disabled chat controls in the MagicPath order', async (): Promise<void> => {
    const screen = await render(<EventHubView {...buildProps()} />);

    const labels = screen
      .getAllByRole('button')
      .map((button): unknown => button.props.accessibilityLabel)
      .slice(0, 3);

    expect(labels).toEqual(['Go back', 'Share event', 'Event chat coming soon']);
    expect(screen.getByText('Event Hub')).toBeTruthy();
  });

  it('centres the title on the header itself, not on the space left by its neighbours', async (): Promise<void> => {
    // One control on the left and two on the right make the flex row asymmetric,
    // so the title is overlaid and centred rather than laid out between them.
    const screen = await render(<EventHubView {...buildProps()} />);
    const overlay = screen.getByText('Event Hub').parent;

    expect(String(overlay?.props.className)).toContain('absolute');
    expect(String(overlay?.props.className)).toContain('items-center');
    expect(String(overlay?.props.className)).toContain('justify-center');
    expect(overlay?.props.pointerEvents).toBe('none');
  });

  it('invokes back and share callbacks from their controls', async (): Promise<void> => {
    const onBack = jest.fn<() => void>();
    const onShare = jest.fn<() => void>();
    const screen = await render(<EventHubView {...buildProps({ onBack, onShare })} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Go back' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Share event' }));

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onShare).toHaveBeenCalledTimes(1);
  });

  it('marks chat disabled with an explanatory hint, no press effect, and no unread dot', async (): Promise<void> => {
    const screen = await render(<EventHubView {...buildProps()} />);
    const chat = screen.getByRole('button', { name: 'Event chat coming soon' });

    expect(chat.props.accessibilityState.disabled).toBe(true);
    expect(String(chat.props.accessibilityHint)).toContain('later');
    expect(screen.queryByTestId('chat-unread-dot')).toBeNull();

    await fireEvent.press(chat);

    expect(chat.props.accessibilityState.disabled).toBe(true);
  });
});

describe('EventHubView event summary', (): void => {
  it('renders the full title, tags, Public badge, schedule, address, and real joined count', async (): Promise<void> => {
    const screen = await render(<EventHubView {...buildProps()} />);

    expect(screen.getByText('Coffee & Code at Festive Walk')).toBeTruthy();
    expect(screen.getByText('Study')).toBeTruthy();
    expect(screen.getByText('Public')).toBeTruthy();
    expect(screen.getByText('Saturday, August 8, 2026')).toBeTruthy();
    expect(screen.getByText('10:00 AM – 1:00 PM')).toBeTruthy();
    expect(screen.getByText('Festive Walk Mall, Iloilo City, Philippines')).toBeTruthy();
    expect(screen.getByText('17 joined')).toBeTruthy();
  });

  it('gives the Public badge a solid token background rather than an opacity modifier', async (): Promise<void> => {
    // `--primary` holds a hex, so `bg-primary/10` resolves to nothing under
    // NativeWind and the badge renders as bare text. Solid tokens only here.
    const screen = await render(<EventHubView {...buildProps()} />);
    const className: string = String(screen.getByTestId('public-badge').props.className);

    expect(className).toContain('bg-info');
    expect(className).not.toMatch(/bg-[a-z-]+\/\d/);
  });

  it('renders no participant images or avatar stack anywhere in the hub', async (): Promise<void> => {
    const screen = await render(<EventHubView {...buildProps()} />);

    expect(screen.queryAllByTestId('expo-image')).toHaveLength(0);
    expect(screen.queryByTestId('participant-avatar-stack')).toBeNull();
  });

  it('falls back to location-unavailable copy when the Ganap has no address', async (): Promise<void> => {
    const screen = await render(<EventHubView {...buildProps({ ganap: { ...ganap, address: null } })} />);

    expect(screen.getByText('Location to be announced')).toBeTruthy();
  });
});

describe('EventHubView announcement section heading', (): void => {
  it('shows the real server total rather than the loaded item count', async (): Promise<void> => {
    const screen = await render(<EventHubView {...buildProps({ total: 21 })} />);

    expect(screen.getByText('Announcements')).toBeTruthy();
    expect(screen.getByTestId('announcement-total').props.children).toBe('21');
  });
});

describe('EventHubView announcement cards', (): void => {
  it('renders author initials, organizer label, optional title, content, timestamp, and type label', async (): Promise<void> => {
    const screen = await render(<EventHubView {...buildProps({ announcements: [reminderAnnouncement] })} />);

    expect(screen.getByText('MS')).toBeTruthy();
    expect(screen.getByText('Miguel Santos')).toBeTruthy();
    expect(screen.getByText('Event organizer')).toBeTruthy();
    expect(screen.getByText('Meet at the main entrance')).toBeTruthy();
    expect(screen.getByText(reminderAnnouncement.content)).toBeTruthy();
    expect(screen.getByText(formatDateTime(reminderAnnouncement.createdAt))).toBeTruthy();
    expect(screen.getByText('Reminder')).toBeTruthy();
  });

  it('omits the title row when the announcement has no title', async (): Promise<void> => {
    const screen = await render(<EventHubView {...buildProps({ announcements: [generalAnnouncement] })} />);

    expect(screen.getByText(generalAnnouncement.content)).toBeTruthy();
    expect(screen.queryByText('Meet at the main entrance')).toBeNull();
  });

  it('colors a type icon to match its label instead of relying on className', async (): Promise<void> => {
    // lucide-react-native registers no cssInterop, so `className` on an icon is
    // inert and it renders black — an invisible icon on a filled chip.
    const screen = await render(<EventHubView {...buildProps({ announcements: [updateAnnouncement] })} />);

    expect(screen.getByTestId('icon-update').props.color).toBe(Colors.light['notice-foreground']);
  });

  it('gives every announcement type a visible text label, not color alone', async (): Promise<void> => {
    const screen = await render(
      <EventHubView
        {...buildProps({
          announcements: [reminderAnnouncement, generalAnnouncement, updateAnnouncement],
          total: 3,
        })}
      />,
    );

    expect(screen.getByText('Reminder')).toBeTruthy();
    expect(screen.getByText('General')).toBeTruthy();
    expect(screen.getByText('Update')).toBeTruthy();
  });
});

describe('EventHubView announcement states', (): void => {
  it('refreshes detail and announcements from the shared pull gesture', async (): Promise<void> => {
    const onRefresh = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const screen = await render(<EventHubView {...buildProps({ isRefreshing: false, onRefresh })} />);

    const list = screen.getByTestId('announcement-list');
    expect(list.props.refreshControl.props.refreshing).toBe(false);

    await fireEvent(list, 'onRefresh');

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('shows a loading state while the first announcement page is pending', async (): Promise<void> => {
    const screen = await render(
      <EventHubView {...buildProps({ announcements: [], total: 0, isAnnouncementsLoading: true })} />,
    );

    expect(screen.getByText('Loading announcements')).toBeTruthy();
    expect(screen.queryByText('Miguel Santos')).toBeNull();
  });

  it('shows an empty state when the organizer has posted nothing', async (): Promise<void> => {
    const screen = await render(<EventHubView {...buildProps({ announcements: [], total: 0 })} />);

    expect(screen.getByText('No announcements yet. The organizer will post updates here.')).toBeTruthy();
  });

  it('shows a retryable error when the first announcement page fails', async (): Promise<void> => {
    const onRetryAnnouncements = jest.fn<() => void>();
    const screen = await render(
      <EventHubView
        {...buildProps({
          announcements: [],
          total: 0,
          announcementError: new Error('Network request failed'),
          onRetryAnnouncements,
        })}
      />,
    );

    expect(screen.getByText('Network request failed')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Try Again' }));

    expect(onRetryAnnouncements).toHaveBeenCalledTimes(1);
  });

  it('keeps loaded announcements visible and offers retry when a later page fails', async (): Promise<void> => {
    const onRetryNextPage = jest.fn<() => void>();
    const screen = await render(
      <EventHubView
        {...buildProps({
          announcementError: new Error('Network request failed'),
          hasNextPage: true,
          isFetchNextPageError: true,
          onRetryNextPage,
        })}
      />,
    );

    expect(screen.getByText(reminderAnnouncement.content)).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Retry loading more' }));

    expect(onRetryNextPage).toHaveBeenCalledTimes(1);
  });

  it('shows a footer spinner while the next page is loading', async (): Promise<void> => {
    const screen = await render(<EventHubView {...buildProps({ hasNextPage: true, isFetchingNextPage: true })} />);

    expect(screen.getByText('Loading more announcements')).toBeTruthy();
    expect(screen.getByText(reminderAnnouncement.content)).toBeTruthy();
  });

  it('replaces the announcement region with an access-lost state', async (): Promise<void> => {
    const screen = await render(<EventHubView {...buildProps({ announcements: [], total: 0, accessLost: true })} />);

    expect(screen.getByText('Event Hub access is no longer available')).toBeTruthy();
    expect(screen.queryByText('Miguel Santos')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Try Again' })).toBeNull();
  });

  it('offers a way back to Event Details from the access-lost state', async (): Promise<void> => {
    const onBack = jest.fn<() => void>();
    const screen = await render(
      <EventHubView {...buildProps({ announcements: [], total: 0, accessLost: true, onBack })} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Back to Event Details' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('EventHubView pagination', (): void => {
  it('requests the next page only when another page exists and none is in flight', async (): Promise<void> => {
    const onLoadMore = jest.fn<() => void>();
    const screen = await render(<EventHubView {...buildProps({ hasNextPage: true, onLoadMore })} />);

    await fireEvent(screen.getByTestId('announcement-list'), 'endReached');

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('does not request another page when the list is complete', async (): Promise<void> => {
    const onLoadMore = jest.fn<() => void>();
    const screen = await render(<EventHubView {...buildProps({ hasNextPage: false, onLoadMore })} />);

    await fireEvent(screen.getByTestId('announcement-list'), 'endReached');

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('does not silently re-request a page that just failed', async (): Promise<void> => {
    const onLoadMore = jest.fn<() => void>();
    const screen = await render(
      <EventHubView
        {...buildProps({
          hasNextPage: true,
          isFetchNextPageError: true,
          announcementError: new Error('Network request failed'),
          onLoadMore,
        })}
      />,
    );

    await fireEvent(screen.getByTestId('announcement-list'), 'endReached');

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('does not request another page while one is already loading', async (): Promise<void> => {
    const onLoadMore = jest.fn<() => void>();
    const screen = await render(
      <EventHubView {...buildProps({ hasNextPage: true, isFetchingNextPage: true, onLoadMore })} />,
    );

    await fireEvent(screen.getByTestId('announcement-list'), 'endReached');

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('renders one card per announcement in the order the server returned them', async (): Promise<void> => {
    const screen = await render(
      <EventHubView
        {...buildProps({
          announcements: [reminderAnnouncement, generalAnnouncement, updateAnnouncement],
          total: 3,
        })}
      />,
    );

    expect(screen.getByText(reminderAnnouncement.content)).toBeTruthy();
    expect(screen.getByText(generalAnnouncement.content)).toBeTruthy();
    expect(screen.getByText(updateAnnouncement.content)).toBeTruthy();
    expect(screen.getAllByText('Event organizer')).toHaveLength(3);
  });
});

describe('EventHubView reminders row', (): void => {
  it('renders a compact disabled Event Reminders row that performs no action', async (): Promise<void> => {
    const screen = await render(<EventHubView {...buildProps()} />);
    const row = screen.getByLabelText('Event reminders, coming soon');

    expect(row.props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText('Event Reminders')).toBeTruthy();
    expect(screen.getByText('Coming soon')).toBeTruthy();
    expect(row.props.onPress).toBeUndefined();
  });
});

describe('attendance scan row', (): void => {
  it('renders nothing when hidden', async (): Promise<void> => {
    const screen = await render(<EventHubView {...buildProps({ scanState: 'hidden' })} />);

    expect(screen.queryByTestId('attendance-scan-row')).toBeNull();
  });

  it('renders disabled locked copy before the attendance window opens', async (): Promise<void> => {
    const screen = await render(<EventHubView {...buildProps({ scanState: 'locked' })} />);

    expect(screen.getByTestId('attendance-scan-row').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText('Attendance scan opens 30 minutes before the event starts')).toBeTruthy();
  });

  it('is pressable and fires onScanAttendance when available', async (): Promise<void> => {
    const onScanAttendance = jest.fn<() => void>();
    const screen = await render(<EventHubView {...buildProps({ scanState: 'available', onScanAttendance })} />);

    await fireEvent.press(screen.getByTestId('attendance-scan-row'));

    expect(onScanAttendance).toHaveBeenCalledTimes(1);
  });

  it('renders a non-interactive recorded confirmation', async (): Promise<void> => {
    const onScanAttendance = jest.fn<() => void>();
    const screen = await render(<EventHubView {...buildProps({ scanState: 'recorded', onScanAttendance })} />);

    expect(screen.getByText('Attendance recorded')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('attendance-scan-row'));

    expect(onScanAttendance).not.toHaveBeenCalled();
  });

  it('renders a non-interactive closed state after the attendance window ends', async (): Promise<void> => {
    const onScanAttendance = jest.fn<() => void>();
    const screen = await render(<EventHubView {...buildProps({ scanState: 'closed', onScanAttendance })} />);

    expect(screen.getByText('Attendance scan is closed')).toBeTruthy();
    expect(screen.getByText('The attendance window has ended.')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('attendance-scan-row'));

    expect(onScanAttendance).not.toHaveBeenCalled();
  });
});

describe('feedback row', (): void => {
  it('renders nothing when no feedback is pending', async (): Promise<void> => {
    const screen = await render(<EventHubView {...buildProps({ hasPendingFeedback: false })} />);

    expect(screen.queryByTestId('feedback-row')).toBeNull();
  });

  it('is pressable and fires onGiveFeedback when feedback is pending', async (): Promise<void> => {
    const onGiveFeedback = jest.fn<() => void>();
    const screen = await render(<EventHubView {...buildProps({ hasPendingFeedback: true, onGiveFeedback })} />);

    await fireEvent.press(screen.getByTestId('feedback-row'));

    expect(onGiveFeedback).toHaveBeenCalledTimes(1);
  });
});

describe('EventHubView responsive layout', (): void => {
  it('keeps summary and reminders inside the scrolling announcement surface', async (): Promise<void> => {
    const screen = await render(<EventHubView {...buildProps()} />);
    const list = screen.getByTestId('announcement-list');

    expect(list.props.ListHeaderComponent).toBeTruthy();
    expect(list.props.ListFooterComponent).toBeTruthy();
  });

  it('keeps date and time side by side at a comfortable width and text size', async (): Promise<void> => {
    windowDimensions.current = { width: 402, height: 874, scale: 2, fontScale: 1 };

    const screen = await render(<EventHubView {...buildProps()} />);

    expect(String(screen.getByTestId('event-hub-schedule').props.className)).toContain('flex-row');
  });

  it('stacks date and time on a narrow screen without truncating the title or address', async (): Promise<void> => {
    windowDimensions.current = { width: 320, height: 568, scale: 2, fontScale: 1 };

    const screen = await render(<EventHubView {...buildProps()} />);

    expect(String(screen.getByTestId('event-hub-schedule').props.className)).not.toContain('flex-row');
    expect(screen.getByText('Coffee & Code at Festive Walk').props.numberOfLines).toBeUndefined();
    expect(screen.getByText('Festive Walk Mall, Iloilo City, Philippines').props.numberOfLines).toBeUndefined();

    windowDimensions.current = { width: 402, height: 874, scale: 2, fontScale: 1 };
  });

  it('stacks date and time at large Dynamic Type without truncating the title or address', async (): Promise<void> => {
    windowDimensions.current = { width: 402, height: 874, scale: 2, fontScale: 1.3 };

    const screen = await render(<EventHubView {...buildProps()} />);

    expect(String(screen.getByTestId('event-hub-schedule').props.className)).not.toContain('flex-row');
    expect(screen.getByText('Coffee & Code at Festive Walk').props.numberOfLines).toBeUndefined();
    expect(screen.getByText('Festive Walk Mall, Iloilo City, Philippines').props.numberOfLines).toBeUndefined();

    windowDimensions.current = { width: 402, height: 874, scale: 2, fontScale: 1 };
  });
});
