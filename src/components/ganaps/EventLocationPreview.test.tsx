import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import { Linking } from 'react-native';
import type { GanapDetail } from '@/types/ganap.types';

jest.mock('@rnmapbox/maps', () => ({
  __esModule: true,
  default: { setAccessToken: jest.fn(), StyleURL: { Dark: 'dark', Street: 'street' } },
  Camera: (): null => null,
  MapView: (): null => null,
  MarkerView: (): null => null,
}));

jest.mock('lucide-react-native', () => ({ MapPin: (): null => null }));

jest.mock('@/hooks/useResolvedTheme', () => ({
  useResolvedTheme: (): 'light' => 'light',
}));

const previousMapboxToken: string | undefined = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
let EventLocationPreview: typeof import('./EventLocationPreview').EventLocationPreview;

const ganap: GanapDetail = {
  id: 'ganap_1',
  businessId: 'business_1',
  businessName: 'Ganapps Demo Business',
  slug: 'student-union-meetup',
  title: 'Student Union Meetup',
  description: 'Meet at the student union.',
  address: 'Student Union',
  locationLat: 10.7313,
  locationLong: 122.5489,
  startDate: '2026-08-08T02:00:00.000Z',
  endDate: '2026-08-08T06:00:00.000Z',
  attendanceOpenMinutesBefore: 30,
  status: 'PUBLISHED',
  requiresApproval: false,
  maxAttendees: 40,
  tags: ['study'],
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

beforeAll((): void => {
  process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN = '';
  const module = require('./EventLocationPreview') as typeof import('./EventLocationPreview');
  EventLocationPreview = module.EventLocationPreview;
});

afterAll((): void => {
  if (previousMapboxToken === undefined) {
    delete process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
  } else {
    process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN = previousMapboxToken;
  }
});

describe('EventLocationPreview', (): void => {
  it('opens the Ganap location in the platform map app from the address card', async (): Promise<void> => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const screen = await render(<EventLocationPreview ganap={ganap} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Open Student Union in maps' }));

    expect(openURL).toHaveBeenCalledWith(expect.stringMatching(/^(https:\/\/maps\.apple\.com\/|geo:)/));
    openURL.mockRestore();
  });

  it('does not make the location actionable when coordinates are invalid', async (): Promise<void> => {
    const screen = await render(<EventLocationPreview ganap={{ ...ganap, locationLong: 181 }} />);

    expect(screen.getByText('Student Union')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Open Student Union in maps' })).toBeNull();
  });
});
