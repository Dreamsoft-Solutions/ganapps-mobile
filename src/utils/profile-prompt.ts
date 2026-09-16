import type { User } from '@/types/user.types';

/**
 * Days a dismissal suppresses the profile completion card.
 *
 * There is deliberately no cap on how many times the card may return — DS-36 originally
 * proposed stopping after three dismissals, and that was dropped by decision. The cooldown
 * is the only brake.
 */
export const PROMPT_COOLDOWN_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** The value persisted under {@link profilePromptStorageKey}. */
export interface ProfilePromptRecord {
  /** Epoch milliseconds of the most recent dismissal. */
  dismissedAt: number;
}

/**
 * Builds the storage key holding one account's dismissal record.
 *
 * Keyed per account rather than per device so two users signing in on one phone do not
 * share a dismissal — the failure mode that made DS-33's device-global onboarding flag
 * wrong. The record deliberately survives logout.
 *
 * @param userId - The signed-in user's id.
 * @returns The AsyncStorage key for that user's record.
 */
export function profilePromptStorageKey(userId: string): string {
  return `ganapps:profile-prompt:${userId}`;
}

/**
 * Decides whether the user has finished the optional second onboarding step.
 *
 * Keyed on `interests` alone. `displayPicture` is deliberately ignored: the server fills it
 * from the Google profile picture on Google sign-up (`auth.service.ts:152`), so every Google
 * account arrives with an avatar and no interests, and treating an avatar as progress would
 * hide the card from exactly the cohort that needs it. Interests are also the signal that
 * matters — they are the only per-user input any future feed personalisation has.
 *
 * `interests` is typed as required, but `EditProfileForm` hedges it with `?? []`, so a response
 * missing the field is evidently considered possible. Hedge here too rather than throwing
 * mid-render.
 *
 * @param user - The signed-in user.
 * @returns `true` when at least one interest is set.
 */
export function hasCompletedExtras(user: User): boolean {
  return (user.interests?.length ?? 0) > 0;
}

/**
 * Decides whether enough time has passed since the last dismissal to show the card again.
 *
 * @param dismissedAt - Epoch milliseconds of the last dismissal, or `null` if never dismissed.
 * @param now - The current time in epoch milliseconds, passed in so this stays pure.
 * @returns `true` when the card may be shown.
 */
export function isPromptDue(dismissedAt: number | null, now: number): boolean {
  if (dismissedAt === null) return true;
  return now - dismissedAt >= PROMPT_COOLDOWN_DAYS * MS_PER_DAY;
}
