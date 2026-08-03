import { describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import type { ComponentProps, ReactElement, ReactNode } from 'react';
import { Text as MockText, View as MockView, type StyleProp, type ViewStyle } from 'react-native';
import type { BusinessDetail } from '@/types/business.types';
import type { GanapDetail } from '@/types/ganap.types';
import type { GanapActionModel, GanapCapacityModel, GanapScheduleModel } from '@/utils/ganap-detail';

jest.mock('expo-image', () => ({
  Image: ({ style }: { style?: StyleProp<ViewStyle> }): ReactElement => (
    <MockView testID="event-detail-image" style={style} />
  ),
}));

jest.mock('lucide-react-native', () => ({
  ArrowLeft: (): null => null,
  Bookmark: (): null => null,
  Calendar: (): null => null,
  Check: ({ strokeWidth }: { strokeWidth?: number }): ReactElement => (
    <MockView testID={`verified-check-${strokeWidth ?? 'default'}`} />
  ),
  Clock: (): null => null,
  Heart: ({ size }: { size?: number }): ReactElement => (
    <MockView testID={size === 16 ? 'likes-heart' : 'action-heart'} />
  ),
  Share2: (): null => null,
  Star: (): null => null,
  Users: (): ReactElement => <MockView testID="capacity-users" />,
}));

jest.mock('react-native-reanimated', () => ({
  useReducedMotion: (): boolean => false,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: (): { top: number; bottom: number; left: number; right: number } => ({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  }),
}));

jest.mock('@/components/common/Avatar', () => ({
  Avatar: (): null => null,
}));

jest.mock('@/components/common/Card', () => ({
  Card: ({ children }: { children: ReactNode }): ReactElement => <MockView>{children}</MockView>,
}));

jest.mock('@/components/common/IconButton', () => ({
  IconButton: ({
    accessibilityHint,
    accessibilityLabel,
    children,
    disabled,
    onPress,
    selected,
  }: {
    accessibilityHint?: string;
    accessibilityLabel: string;
    children: ReactNode;
    disabled?: boolean;
    onPress: () => void;
    selected?: boolean;
  }): ReactElement => {
    const buttonProps = {
      accessible: true,
      accessibilityHint,
      accessibilityLabel,
      accessibilityRole: 'button' as const,
      accessibilityState: { disabled: Boolean(disabled), selected: Boolean(selected) },
      onPress,
    } as unknown as ComponentProps<typeof MockView>;

    return <MockView {...buttonProps}>{children}</MockView>;
  },
}));

jest.mock('@/components/common/Text', () => ({
  Text: ({ children }: { children: ReactNode }): ReactElement => <MockText>{children}</MockText>,
}));

jest.mock('./EventActionBar', () => ({
  EventActionBar: (): null => null,
}));

jest.mock('./EventLocationPreview', () => ({
  EventLocationPreview: (): null => null,
}));

import { EventDetailView } from './EventDetailView';

const ganap: GanapDetail = {
  id: 'ganap_1',
  businessId: 'business_1',
  businessName: 'Ganapps Demo Business',
  slug: 'test-event-banner-image-priority',
  title: 'Test Event Banner Image Priority',
  description: 'A test event with a banner image.',
  address: 'Student Union',
  locationLat: 10.7313,
  locationLong: 122.5489,
  startDate: '2026-08-08T02:00:00.000Z',
  endDate: '2026-08-08T06:00:00.000Z',
  status: 'PUBLISHED',
  requiresApproval: false,
  maxAttendees: 40,
  tags: ['test'],
  coverImage: 'https://example.com/cover.jpg',
  bannerImage: 'https://example.com/banner.jpg',
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

const business: BusinessDetail = {
  id: 'business_1',
  name: 'Ganapps Demo Business',
  slug: 'ganapps-demo-business',
  bio: null,
  displayPicture: null,
  verificationStatus: 'ACTIVE',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

const capacity: GanapCapacityModel = {
  summary: 'Be the first to join',
  detail: '40 spots available',
  isFull: false,
};

const schedule: GanapScheduleModel = {
  dateLabel: 'Saturday, August 8, 2026',
  timeLabel: '10:00 AM – 2:00 PM',
};

const actionModel: GanapActionModel = {
  statusLabel: null,
  action: 'join',
  actionLabel: 'Join event',
  confirmation: null,
};

describe('EventDetailView media', (): void => {
  it('gives a remote hero image explicit dimensions', async (): Promise<void> => {
    const screen = await render(
      <EventDetailView
        ganap={ganap}
        business={business}
        capacity={capacity}
        schedule={schedule}
        actionModel={actionModel}
        isPrimaryPending={false}
        isLikePending={false}
        isSavePending={false}
        onBack={(): void => {}}
        onShare={(): void => {}}
        onToggleLike={(): void => {}}
        onToggleSave={(): void => {}}
        onPrimaryAction={(): void => {}}
      />,
    );

    expect(screen.getByTestId('event-detail-image').props.style).toMatchObject({
      width: '100%',
      height: '100%',
    });
  });
});

describe('EventDetailView social actions', (): void => {
  it('allows unregistered users to like and save an event', async (): Promise<void> => {
    const onToggleLike = jest.fn<() => void>();
    const onToggleSave = jest.fn<() => void>();
    const screen = await render(
      <EventDetailView
        ganap={ganap}
        business={business}
        capacity={capacity}
        schedule={schedule}
        actionModel={actionModel}
        isPrimaryPending={false}
        isLikePending={false}
        isSavePending={false}
        onBack={(): void => {}}
        onShare={(): void => {}}
        onToggleLike={onToggleLike}
        onToggleSave={onToggleSave}
        onPrimaryAction={(): void => {}}
      />,
    );

    const likeButton = screen.getByRole('button', { name: 'Like event' });
    const saveButton = screen.getByRole('button', { name: 'Save event' });

    expect(likeButton.props.accessibilityState.disabled).toBe(false);
    expect(saveButton.props.accessibilityState.disabled).toBe(false);

    likeButton.props.onPress();
    saveButton.props.onPress();

    expect(onToggleLike).toHaveBeenCalledTimes(1);
    expect(onToggleSave).toHaveBeenCalledTimes(1);
  });
});

describe('EventDetailView icon spacing', (): void => {
  it('places spacing on a wrapper around the likes icon', async (): Promise<void> => {
    const screen = await render(
      <EventDetailView
        ganap={ganap}
        business={business}
        capacity={capacity}
        schedule={schedule}
        actionModel={actionModel}
        isPrimaryPending={false}
        isLikePending={false}
        isSavePending={false}
        onBack={(): void => {}}
        onShare={(): void => {}}
        onToggleLike={(): void => {}}
        onToggleSave={(): void => {}}
        onPrimaryAction={(): void => {}}
      />,
    );

    expect(screen.getByTestId('likes-heart').parent?.props.className).toContain('mr-xs');
  });

  it('places spacing on a wrapper around the capacity icon', async (): Promise<void> => {
    const screen = await render(
      <EventDetailView
        ganap={ganap}
        business={business}
        capacity={capacity}
        schedule={schedule}
        actionModel={actionModel}
        isPrimaryPending={false}
        isLikePending={false}
        isSavePending={false}
        onBack={(): void => {}}
        onShare={(): void => {}}
        onToggleLike={(): void => {}}
        onToggleSave={(): void => {}}
        onPrimaryAction={(): void => {}}
      />,
    );

    expect(screen.getByTestId('capacity-users').parent?.props.className).toContain('mr-sm');
  });

  it('uses a heavier stroke for the verified check icon', async (): Promise<void> => {
    const screen = await render(
      <EventDetailView
        ganap={ganap}
        business={business}
        capacity={capacity}
        schedule={schedule}
        actionModel={actionModel}
        isPrimaryPending={false}
        isLikePending={false}
        isSavePending={false}
        onBack={(): void => {}}
        onShare={(): void => {}}
        onToggleLike={(): void => {}}
        onToggleSave={(): void => {}}
        onPrimaryAction={(): void => {}}
      />,
    );

    expect(screen.getByTestId('verified-check-2.5').parent?.props.className).toContain('mr-xs');
  });
});
