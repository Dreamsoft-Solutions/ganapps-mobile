import { describe, expect, it } from '@jest/globals';
import { shouldHideAppTabBar } from './navigation';

describe('app tab bar route policy', (): void => {
  it('hides the tab bar for a registration route', (): void => {
    expect(shouldHideAppTabBar(['(app)', '(home)', 'registration', '[ganap-id]'])).toBe(true);
  });

  it('keeps the tab bar for non-registration routes', (): void => {
    expect(shouldHideAppTabBar(['(app)', '(home)', '[ganap-id]'])).toBe(false);
    expect(shouldHideAppTabBar(['(app)', '(profile)', 'profile'])).toBe(false);
  });

  it('hides the tab bar for the Event Hub route', (): void => {
    expect(shouldHideAppTabBar(['(app)', '(home)', 'event-hub', '[ganap-id]'])).toBe(true);
  });
});
