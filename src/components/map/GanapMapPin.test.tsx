import { describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import type { ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';
import type { GanapListItem } from '@/types/ganap.types';

jest.mock('expo-image', () => ({
  Image: (): null => null,
}));

jest.mock('lucide-react-native', () => ({
  MapPin: (): null => null,
}));

jest.mock('@/hooks/useResolvedTheme', () => ({
  useResolvedTheme: (): 'light' => 'light',
}));

import { GanapMapPin } from './GanapMapPin';

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
  endDate: '2026-08-08T04:00:00.000Z',
  attendanceOpenMinutesBefore: 30,
  tags: ['study'],
  coverImage: null,
  mapPinImage: null,
  registrationCount: 5,
  likesCount: 2,
  createdAt: '2026-08-01T00:00:00.000Z',
};

function numericStyle(style: ViewStyle, property: 'height' | 'left' | 'top' | 'width'): number {
  const value: unknown = style[property];
  if (typeof value !== 'number') throw new Error(`${property} must be numeric`);
  return value;
}

describe('GanapMapPin', (): void => {
  it('contains the rotated pin and puts its tip on the wrapper bottom', async (): Promise<void> => {
    const screen = await render(<GanapMapPin ganap={ganap} />);
    const wrapper = StyleSheet.flatten(screen.getByTestId('ganap-map-pin').props.style) as ViewStyle;
    const shape = StyleSheet.flatten(screen.getByTestId('ganap-map-pin-shape').props.style) as ViewStyle;
    const wrapperWidth = numericStyle(wrapper, 'width');
    const wrapperHeight = numericStyle(wrapper, 'height');
    const shapeWidth = numericStyle(shape, 'width');
    const shapeHeight = numericStyle(shape, 'height');
    const shapeLeft = numericStyle(shape, 'left');
    const shapeTop = numericStyle(shape, 'top');
    const rotatedExtent = shapeWidth * Math.SQRT2;
    const rotatedTop = shapeTop + (shapeHeight - rotatedExtent) / 2;
    const rotatedBottom = rotatedTop + rotatedExtent;
    const tipX = shapeLeft + shapeWidth / 2;
    const tipY = shapeTop + shapeHeight / 2 + shapeHeight / Math.SQRT2;

    expect(wrapperWidth).toBe(80);
    expect(wrapperHeight).toBe(80);
    expect(tipX).toBeCloseTo(wrapperWidth / 2, 5);
    expect(tipY).toBeCloseTo(wrapperHeight, 5);
    expect(rotatedTop).toBeGreaterThanOrEqual(0);
    expect(rotatedBottom).toBeLessThanOrEqual(wrapperHeight);
  });
});
