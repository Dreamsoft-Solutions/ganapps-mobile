import { describe, expect, it } from '@jest/globals';
import {
  ILOILO_LATITUDE,
  MIN_VISIBLE_SPAN_KM,
  NARROWEST_VIEWPORT_WIDTH_POINTS,
  SUPPORTED_VIEWPORT_WIDTHS_POINTS,
  USER_ZOOM,
  visibleGroundDistanceKm,
} from '@/utils/map-viewport';

describe('visibleGroundDistanceKm', (): void => {
  it('halves the distance covered for each whole zoom step', (): void => {
    const wide = visibleGroundDistanceKm(12, ILOILO_LATITUDE, 440);
    const close = visibleGroundDistanceKm(13, ILOILO_LATITUDE, 440);

    expect(close).toBeCloseTo(wide / 2, 6);
  });

  it('measures zoom against 512 point tiles, not 256', (): void => {
    const tiles512 = visibleGroundDistanceKm(12, 0, 512);
    const equatorCircumferenceKm = 40_075.016686;

    expect(tiles512).toBeCloseTo(equatorCircumferenceKm / 2 ** 12, 6);
  });
});

describe('USER_ZOOM', (): void => {
  it.each(SUPPORTED_VIEWPORT_WIDTHS_POINTS)('shows at least the minimum span at %i points', (width): void => {
    const visible = visibleGroundDistanceKm(USER_ZOOM, ILOILO_LATITUDE, width);

    expect(visible).toBeGreaterThanOrEqual(MIN_VISIBLE_SPAN_KM);
  });

  it('is bounded by the narrowest supported screen', (): void => {
    const narrowest = Math.min(...SUPPORTED_VIEWPORT_WIDTHS_POINTS);

    expect(narrowest).toBe(NARROWEST_VIEWPORT_WIDTH_POINTS);
  });
});
