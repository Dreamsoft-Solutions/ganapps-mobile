import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import type { GanapListItem } from '@/types/ganap.types';

jest.mock('expo-image', () => ({
  Image: (): null => null,
}));

jest.mock('lucide-react-native', () => ({
  Calendar: (): null => null,
  MapPin: (): null => null,
  Users: (): null => null,
  X: (): null => null,
}));

import { SelectedGanapCard } from './SelectedGanapCard';

const ganap: GanapListItem = {
  id: 'ganap_1',
  businessId: 'business_1',
  businessName: 'CPU Developers',
  slug: 'coffee-and-code',
  title: 'Coffee & Code',
  description: 'Bring a laptop.',
  address: 'Student Union',
  locationLat: 10.7313,
  locationLong: 122.5489,
  startDate: '2026-08-08T02:00:00.000Z',
  attendanceOpenMinutesBefore: 30,
  tags: ['study'],
  coverImage: null,
  mapPinImage: null,
  registrationCount: 5,
  createdAt: '2026-08-01T00:00:00.000Z',
};

describe('SelectedGanapCard', (): void => {
  it('opens the selected event when the preview card is pressed', async (): Promise<void> => {
    const onPress = jest.fn<() => void>();
    const screen = await render(<SelectedGanapCard ganap={ganap} onClose={(): void => {}} onPress={onPress} />);

    fireEvent.press(screen.getByRole('button', { name: 'Open event details for Coffee & Code' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
