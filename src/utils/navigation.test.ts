import { describe, expect, it } from '@jest/globals';
import { Routes } from '@/constants/routes';
import { getShareLinkReturnRoute, hasShareLinkReturnTarget, shouldHideAppTabBar } from './navigation';

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

  it('hides the tab bar for a focused Event Chat thread', (): void => {
    expect(shouldHideAppTabBar(['(app)', '(chat)', 'event-chat', '[ganap-id]'])).toBe(true);
  });
});

describe('share-link sign-in return route', (): void => {
  it('opens the Add Friend flow with a normalized Friend Code after sign-in', (): void => {
    expect(getShareLinkReturnRoute({ returnFriendCode: '0123456789ab' })).toEqual(
      Routes.friendAddWithCode('0123456789AB'),
    );
  });

  it('opens Ganap detail after sign-in', (): void => {
    expect(getShareLinkReturnRoute({ returnGanapId: 'event_123-abc' })).toEqual(Routes.ganapDetail('event_123-abc'));
  });

  it('falls back to the Map tab for invalid or ambiguous targets', (): void => {
    expect(getShareLinkReturnRoute({ returnFriendCode: 'bad' })).toEqual(Routes.app.home);
    expect(getShareLinkReturnRoute({ returnFriendCode: '0123456789AB', returnGanapId: 'event_123-abc' })).toEqual(
      Routes.app.home,
    );
  });

  it('keeps only valid share targets from being redirected during login', (): void => {
    expect(hasShareLinkReturnTarget({ returnFriendCode: '0123456789AB' })).toBe(true);
    expect(hasShareLinkReturnTarget({ returnGanapId: 'event_123-abc' })).toBe(true);
    expect(hasShareLinkReturnTarget({ returnFriendCode: 'bad' })).toBe(false);
    expect(hasShareLinkReturnTarget({ returnFriendCode: '0123456789AB', returnGanapId: 'event_123-abc' })).toBe(false);
  });
});
