import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Colors } from '@/constants/theme';
import type { GanapListItem } from '@/types/ganap.types';
import { GanapFeedCard } from './GanapFeedCard';

jest.mock('lucide-react-native', () => {
  const React = require('react') as typeof import('react');
  const { View } = require('react-native') as typeof import('react-native');
  return {
    Clock: (props: { color?: string }): ReactElement => React.createElement(View, { testID: 'icon-clock', ...props }),
    MapPin: (props: { color?: string }): ReactElement =>
      React.createElement(View, { testID: 'icon-map-pin', ...props }),
    Users: (props: { color?: string }): ReactElement => React.createElement(View, { testID: 'icon-users', ...props }),
    Calendar: (props: { color?: string }): ReactElement =>
      React.createElement(View, { testID: 'icon-calendar', ...props }),
  };
});

/** Builds a list item with everything populated; tests strip what they are about. */
function ganap(overrides: Partial<GanapListItem> = {}): GanapListItem {
  return {
    id: 'ganap_1',
    businessId: 'business_1',
    businessName: 'CPU Republic',
    slug: 'acoustic-jam',
    title: 'Weekend Acoustic Jam',
    description: '',
    address: 'Plazuela de Iloilo',
    locationLat: 10.72,
    locationLong: 122.56,
    startDate: new Date('2026-09-19T17:00:00').toISOString(),
    endDate: null,
    attendanceOpenMinutesBefore: 30,
    tags: ['Music'],
    coverImage: null,
    mapPinImage: null,
    registrationCount: 9,
    likesCount: 0,
    createdAt: new Date().toISOString(),
    isLiked: false,
    isSaved: false,
    ...overrides,
  };
}

describe('GanapFeedCard', () => {
  it('shows the title, organization, address and attendee count', async (): Promise<void> => {
    const screen = await render(<GanapFeedCard ganap={ganap()} onPress={jest.fn()} />);

    expect(screen.getByText('Weekend Acoustic Jam')).toBeTruthy();
    expect(screen.getByText('CPU Republic')).toBeTruthy();
    expect(screen.getByText('Plazuela de Iloilo')).toBeTruthy();
    expect(screen.getByText('5+ attending')).toBeTruthy();
  });

  it('shows the first tag as the category pill', async (): Promise<void> => {
    const screen = await render(<GanapFeedCard ganap={ganap({ tags: ['Music', 'Arts'] })} onPress={jest.fn()} />);

    expect(screen.getByTestId('ganap-feed-card-category')).toBeTruthy();
    expect(screen.getByText('Music')).toBeTruthy();
  });

  it('hides the location row when the event has no address', async (): Promise<void> => {
    const screen = await render(<GanapFeedCard ganap={ganap({ address: null })} onPress={jest.fn()} />);

    expect(screen.queryByTestId('ganap-feed-card-location')).toBeNull();
  });

  it('hides the category pill when the event has no tags', async (): Promise<void> => {
    const screen = await render(<GanapFeedCard ganap={ganap({ tags: [] })} onPress={jest.fn()} />);

    expect(screen.queryByTestId('ganap-feed-card-category')).toBeNull();
  });

  it('falls back to the organization initial when there is no logo', async (): Promise<void> => {
    const screen = await render(<GanapFeedCard ganap={ganap()} onPress={jest.fn()} />);

    expect(screen.getByTestId('ganap-feed-card-host-initial')).toBeTruthy();
    expect(screen.getByText('C')).toBeTruthy();
  });

  it('uses the same attendance estimate for the visible card and accessibility label', async (): Promise<void> => {
    const screen = await render(<GanapFeedCard ganap={ganap()} onPress={jest.fn()} />);

    expect(screen.queryByText(/\d+\s*\/\s*\d+/)).toBeNull();
    expect(screen.getByRole('button').props.accessibilityLabel).toBe(
      'Weekend Acoustic Jam, hosted by CPU Republic, 5+ attending',
    );
    expect(screen.queryByText('9')).toBeNull();
  });

  it('colours its icons from the theme, not from an inert className', async (): Promise<void> => {
    const screen = await render(<GanapFeedCard ganap={ganap()} onPress={jest.fn()} />);

    expect(screen.getByTestId('icon-clock').props.color).toBe(Colors.light.primary);
    expect(screen.getByTestId('icon-map-pin').props.color).toBe(Colors.light.primary);
    expect(screen.getByTestId('icon-users').props.color).toBe(Colors.light['muted-foreground']);
  });

  it('shows the cover image when the event has one', async (): Promise<void> => {
    const screen = await render(
      <GanapFeedCard ganap={ganap({ coverImage: 'https://example.test/cover.jpg' })} onPress={jest.fn()} />,
    );

    expect(screen.getByLabelText('Weekend Acoustic Jam event poster')).toBeTruthy();
    expect(screen.queryByTestId('ganap-feed-card-cover-placeholder')).toBeNull();
  });

  it('falls back to a calendar placeholder when there is no cover image', async (): Promise<void> => {
    const screen = await render(<GanapFeedCard ganap={ganap({ coverImage: null })} onPress={jest.fn()} />);

    expect(screen.getByTestId('ganap-feed-card-cover-placeholder')).toBeTruthy();
  });

  it('sizes the poster with a style, not a className expo-image would drop', async (): Promise<void> => {
    /**
     * This app registers cssInterop only for SafeAreaView, so NativeWind drops a
     * className on expo-image without erroring and the poster collapses to
     * nothing. The size has to reach the image as a real style.
     */
    const screen = await render(
      <GanapFeedCard ganap={ganap({ coverImage: 'https://example.test/cover.jpg' })} onPress={jest.fn()} />,
    );

    const poster = screen.getByLabelText('Weekend Acoustic Jam event poster');

    expect(poster.props.style).toEqual({ width: '100%', height: '100%' });
  });

  it('shows the end time so an evening reads as one sitting', async (): Promise<void> => {
    const screen = await render(
      <GanapFeedCard
        ganap={ganap({
          startDate: new Date('2026-09-19T21:00:00').toISOString(),
          endDate: new Date('2026-09-20T05:00:00').toISOString(),
        })}
        onPress={jest.fn()}
      />,
    );

    expect(screen.getByText(/9:00 PM – 5:00 AM/)).toBeTruthy();
  });

  it('shows the start alone when the organizer left the end open', async (): Promise<void> => {
    const screen = await render(<GanapFeedCard ganap={ganap({ endDate: null })} onPress={jest.fn()} />);

    expect(screen.queryByText(/–/)).toBeNull();
  });

  it('calls onPress when the card is tapped', async (): Promise<void> => {
    const onPress = jest.fn();
    const screen = await render(<GanapFeedCard ganap={ganap()} onPress={onPress} />);

    await fireEvent.press(screen.getByTestId('ganap-feed-card'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
