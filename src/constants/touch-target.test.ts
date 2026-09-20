import { describe, expect, it } from '@jest/globals';
import { effectiveTargetPx, MIN_TOUCH_TARGET } from './touch-target';

describe('touch target floor', (): void => {
  it('states the stricter of the two platform minimums', (): void => {
    expect(MIN_TOUCH_TARGET).toBe(48);
  });

  it('counts hit slop on both sides of the rendered size', (): void => {
    expect(effectiveTargetPx({ sizePx: 36, hitSlop: 6 })).toBe(48);
  });

  it('returns the rendered size when there is no slop', (): void => {
    expect(effectiveTargetPx({ sizePx: 48, hitSlop: 0 })).toBe(48);
  });
});
