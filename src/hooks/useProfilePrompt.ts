import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { needsOnboarding } from '@/utils/onboarding';
import {
  hasCompletedExtras,
  isPromptDue,
  type ProfilePromptRecord,
  profilePromptStorageKey,
} from '@/utils/profile-prompt';
import { storage } from '@/utils/storage';

/** What {@link useProfilePrompt} returns. */
export interface UseProfilePromptResult {
  /** Whether the profile completion card should be rendered right now. */
  isVisible: boolean;
  /** Hides the card and starts a fresh cooldown. */
  dismiss: () => void;
}

/**
 * Records a dismissal for one account, starting the cooldown.
 *
 * Exported separately from the hook so `OnboardingForm` can seed a timestamp as the user
 * leaves step two — which is what stops the card appearing on the very next visit to
 * Profile — without mounting the hook. Every write of the record goes through here.
 *
 * @param userId - The account to record the dismissal against.
 * @returns A promise resolving once the write has been attempted. Storage failures are
 * swallowed by the storage wrapper; the worst outcome is one extra card.
 */
export async function recordPromptDismissal(userId: string): Promise<void> {
  const record: ProfilePromptRecord = { dismissedAt: Date.now() };
  await storage.set(profilePromptStorageKey(userId), record);
}

/**
 * Decides whether to show the card inviting the user to finish optional onboarding.
 *
 * Visible only when the user has completed step one (so DS-33's blocking redirect is not
 * competing for the same user), has no interests, and is outside the dismissal cooldown.
 * Hidden until the stored record has been read, so the card cannot appear and then vanish.
 *
 * @returns The card's visibility and its dismiss handler.
 */
export function useProfilePrompt(): UseProfilePromptResult {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? null;
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect((): (() => void) | undefined => {
    if (userId === null) return undefined;

    let cancelled = false;
    setIsLoaded(false);

    storage.get<ProfilePromptRecord>(profilePromptStorageKey(userId)).then((record): void => {
      if (cancelled) return;
      setDismissedAt(record?.dismissedAt ?? null);
      setIsLoaded(true);
    });

    return (): void => {
      cancelled = true;
    };
  }, [userId]);

  const dismiss = useCallback((): void => {
    if (userId === null) return;
    // Update local state first so the card disappears on tap rather than after the write.
    setDismissedAt(Date.now());
    void recordPromptDismissal(userId);
  }, [userId]);

  const isVisible =
    isLoaded &&
    user !== null &&
    !needsOnboarding(user) &&
    !hasCompletedExtras(user) &&
    isPromptDue(dismissedAt, Date.now());

  return { isVisible, dismiss };
}
