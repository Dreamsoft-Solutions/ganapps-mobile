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
    segments.includes('friend-settings')
  );
}
