import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { View as MockView } from 'react-native';
import type { GanapStatus } from '@/types/ganap.types';
import type { SavedGanap } from '@/types/profile.types';

jest.mock('expo-image', () => ({
  Image: (): ReactElement => <MockView testID="saved-ganap-image" />,
}));

jest.mock('lucide-react-native', () => ({
  Bookmark: (): ReactElement => <MockView testID="saved-ganap-bookmark" />,
  Calendar: (): ReactElement => <MockView testID="saved-ganap-calendar" />,
  Clock: (): ReactElement => <MockView testID="saved-ganap-clock" />,
}));

import { SavedGanapCard } from './SavedGanapCard';

function savedGanap(overrides: Partial<SavedGanap> = {}): SavedGanap {
  return {
    id: 'saved_1',
    businessId: 'business_1',
    businessName: 'CPU Developers',
    slug: 'campus-day',
    title: 'Campus Day',
    startDate: '2026-09-30T01:00:00.000Z',
    endDate: null,
    status: 'PUBLISHED',
    tags: ['community'],
    coverImage: null,
    savedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

const pillCases: Array<[GanapStatus, string]> = [
  ['ONGOING', 'In progress'],
  ['COMPLETED', 'Ended'],
  ['CANCELLED', 'Cancelled'],
];

describe('SavedGanapCard', () => {
  it('shows the event title and organization', async (): Promise<void> => {
    const screen = await render(<SavedGanapCard ganap={savedGanap()} />);

    expect(screen.getByText('Campus Day')).toBeTruthy();
    expect(screen.getByText('CPU Developers')).toBeTruthy();
  });

  it.each(pillCases)('labels a %s event as "%s"', async (status: GanapStatus, label: string): Promise<void> => {
    const screen = await render(<SavedGanapCard ganap={savedGanap({ status })} />);

    expect(screen.getByText(label)).toBeTruthy();
  });

  it('shows no status pill for an ordinary upcoming event', async (): Promise<void> => {
    const screen = await render(<SavedGanapCard ganap={savedGanap({ status: 'PUBLISHED' })} />);

    expect(screen.queryByTestId('saved-ganap-status')).toBeNull();
  });

  it('reports a press on the row', async (): Promise<void> => {
    const onPress = jest.fn();
    const screen = await render(<SavedGanapCard ganap={savedGanap()} onPress={onPress} />);

    fireEvent.press(screen.getByRole('button', { name: 'Campus Day' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('omits the unsave control when no handler is given', async (): Promise<void> => {
    const screen = await render(<SavedGanapCard ganap={savedGanap()} />);

    expect(screen.queryByTestId('saved-ganap-bookmark')).toBeNull();
  });

  it('reports an unsave without opening the event', async (): Promise<void> => {
    const onPress = jest.fn();
    const onUnsave = jest.fn();
    const screen = await render(<SavedGanapCard ganap={savedGanap()} onPress={onPress} onUnsave={onUnsave} />);

    fireEvent.press(screen.getByRole('button', { name: 'Remove Campus Day from saved events' }));

    expect(onUnsave).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });
});
