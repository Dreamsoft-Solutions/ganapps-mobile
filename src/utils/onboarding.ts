import type { User } from '@/types/user.types';

/**
 * Decides whether a user still has to complete the required onboarding step.
 *
 * Keyed on `lastName` rather than a device-local flag so the answer is per-account,
 * server-authoritative, and survives reinstalls and device changes. `lastName` is the
 * reliable signal: registration never sets it — `registerSchema` collects only username,
 * email and password — and Google sign-up populates `firstName` alone, dumping the full
 * display name there and leaving `lastName` null. `interests` is unusable for this because
 * an empty array means both "never onboarded" and "onboarded, picked nothing".
 *
 * @param user - The signed-in user, or `null` while the profile query is still loading.
 * @returns `true` when the user must be routed to onboarding; `false` when there is no user
 * yet, so a pending load never triggers a redirect.
 */
export function needsOnboarding(user: User | null): boolean {
  if (!user) return false;
  return !user.lastName || user.lastName.trim().length === 0;
}
