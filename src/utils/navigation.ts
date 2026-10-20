import type { Href } from 'expo-router';
import { Routes } from '@/constants/routes';
import { isValidFriendCode, normalizeFriendCode } from '@/utils/friends';
import { isValidGanapShareId } from '@/utils/share-links';

/** Share-link parameters carried on the login route until sign-in completes. */
export interface ShareLinkReturnParams {
  returnFriendCode?: string | string[];
  returnGanapId?: string | string[];
}

type ValidShareLinkReturnTarget = { kind: 'friend'; code: string } | { kind: 'ganap'; id: string };

function getValidShareLinkReturnTarget(params: ShareLinkReturnParams): ValidShareLinkReturnTarget | null {
  const friendCode: string | undefined =
    typeof params.returnFriendCode === 'string' ? normalizeFriendCode(params.returnFriendCode) : undefined;
  const ganapId: string | undefined = typeof params.returnGanapId === 'string' ? params.returnGanapId : undefined;
  const hasValidFriendCode: boolean = friendCode !== undefined && isValidFriendCode(friendCode);
  const hasValidGanapId: boolean = ganapId !== undefined && isValidGanapShareId(ganapId);

  if (friendCode !== undefined && hasValidFriendCode && !hasValidGanapId) {
    return { kind: 'friend', code: friendCode };
  }
  if (ganapId !== undefined && hasValidGanapId && !hasValidFriendCode) {
    return { kind: 'ganap', id: ganapId };
  }
  return null;
}

/**
 * Reports whether login carries one valid share target to restore after authentication.
 *
 * @param params - Query parameters attached to the login screen.
 * @returns `true` when exactly one valid Friend Code or Ganap ID is present.
 */
export function hasShareLinkReturnTarget(params: ShareLinkReturnParams): boolean {
  return getValidShareLinkReturnTarget(params) !== null;
}

/**
 * Resolves only known, validated share targets after a successful sign-in.
 *
 * @param params - Query parameters attached to the login screen.
 * @returns The intended internal screen, or the Map tab when the parameters are invalid.
 */
export function getShareLinkReturnRoute(params: ShareLinkReturnParams): Href {
  const target: ValidShareLinkReturnTarget | null = getValidShareLinkReturnTarget(params);
  if (target?.kind === 'friend') return Routes.friendAddWithCode(target.code);
  if (target?.kind === 'ganap') return Routes.ganapDetail(target.id);
  return Routes.app.home;
}

/**
 * Determines whether the authenticated tab bar should be hidden for a focused route.
 *
 * @param segments - Active Expo Router path segments
 * @returns `true` while completing an event registration form, inside the Event Hub,
 * a focused Event Chat thread, or a focused Friends profile/settings screen
 */
export function shouldHideAppTabBar(segments: readonly string[]): boolean {
  return (
    segments.includes('registration') ||
    segments.includes('event-hub') ||
    segments.includes('event-chat') ||
    segments.includes('friend-profile') ||
    segments.includes('friend-settings') ||
    segments.includes('direct-chat')
  );
}
