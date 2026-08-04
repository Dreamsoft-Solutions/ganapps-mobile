/**
 * Determines whether the authenticated tab bar should be hidden for a focused route.
 *
 * @param segments - Active Expo Router path segments
 * @returns `true` while completing an event registration form or inside the Event Hub
 */
export function shouldHideAppTabBar(segments: readonly string[]): boolean {
  return segments.includes('registration') || segments.includes('event-hub');
}
