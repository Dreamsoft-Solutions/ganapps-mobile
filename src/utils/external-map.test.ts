import { describe, expect, it } from '@jest/globals';
import { getExternalMapLinks } from './external-map';

describe('getExternalMapLinks', (): void => {
  it('builds Apple Maps and web fallback links for iOS', (): void => {
    expect(
      getExternalMapLinks({ latitude: 10.7313, longitude: 122.5489 }, 'ios', 'Central Philippine University'),
    ).toEqual({
      preferredUrl: 'https://maps.apple.com/?ll=10.7313,122.5489&q=Central%20Philippine%20University',
      fallbackUrl: 'https://www.google.com/maps/search/?api=1&query=10.7313%2C122.5489',
    });
  });

  it('builds a native geo intent for Android that can open a map app chooser', (): void => {
    expect(
      getExternalMapLinks({ latitude: 10.7313, longitude: 122.5489 }, 'android', 'Central Philippine University'),
    ).toEqual({
      preferredUrl: 'geo:10.7313,122.5489?q=10.7313,122.5489(Central%20Philippine%20University)',
      fallbackUrl: 'https://www.google.com/maps/search/?api=1&query=10.7313%2C122.5489',
    });
  });

  it.each([
    [{ latitude: Number.NaN, longitude: 122.5489 }],
    [{ latitude: 91, longitude: 122.5489 }],
    [{ latitude: 10.7313, longitude: -181 }],
  ])('does not create a link for invalid coordinates: %j', (coordinates): void => {
    expect(getExternalMapLinks(coordinates, 'android')).toBeNull();
  });
});
