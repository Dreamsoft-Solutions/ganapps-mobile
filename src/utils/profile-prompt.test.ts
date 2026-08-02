import { describe, expect, it } from '@jest/globals';
import type { User } from '@/types/user.types';
import { hasCompletedExtras, isPromptDue, PROMPT_COOLDOWN_DAYS, profilePromptStorageKey } from './profile-prompt';

/** Builds a user carrying only the fields these predicates read. */
function userWith(overrides: Partial<User>): User {
  return {
    id: 'user_1',
    email: 'maria@example.com',
    username: 'maria',
    firstName: 'Maria',
    lastName: 'Santos',
    displayPicture: null,
    interests: [],
    isVerified: true,
    createdAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = 1_754_000_000_000;

describe('hasCompletedExtras', (): void => {
  it('returns false when no interests are set', (): void => {
    expect(hasCompletedExtras(userWith({ interests: [] }))).toBe(false);
  });

  it('returns true once at least one interest is set', (): void => {
    expect(hasCompletedExtras(userWith({ interests: ['food'] }))).toBe(true);
  });

  it('ignores displayPicture, because Google sign-up sets it automatically', (): void => {
    // A Google user arrives with an avatar and no interests. They are exactly who
    // the card is for, so an avatar must not count as progress.
    const googleUser = userWith({
      displayPicture: 'https://lh3.googleusercontent.com/a/photo.jpg',
      interests: [],
    });

    expect(hasCompletedExtras(googleUser)).toBe(false);
  });

  it('returns false rather than throwing when the field is absent', (): void => {
    // Typed as required, but EditProfileForm hedges it with ?? [], so treat it as possible.
    const withoutInterests = { ...userWith({}), interests: undefined } as unknown as User;

    expect(hasCompletedExtras(withoutInterests)).toBe(false);
  });
});

describe('isPromptDue', (): void => {
  it('is due when nothing has been dismissed yet', (): void => {
    expect(isPromptDue(null, NOW)).toBe(true);
  });

  it('is not due immediately after a dismissal', (): void => {
    expect(isPromptDue(NOW, NOW)).toBe(false);
  });

  it('is not due one day after a dismissal', (): void => {
    expect(isPromptDue(NOW - DAY_MS, NOW)).toBe(false);
  });

  it('is not due one millisecond before the cooldown elapses', (): void => {
    expect(isPromptDue(NOW - (PROMPT_COOLDOWN_DAYS * DAY_MS - 1), NOW)).toBe(false);
  });

  it('is due at exactly the cooldown boundary', (): void => {
    expect(isPromptDue(NOW - PROMPT_COOLDOWN_DAYS * DAY_MS, NOW)).toBe(true);
  });

  it('is due eight days after a dismissal', (): void => {
    expect(isPromptDue(NOW - 8 * DAY_MS, NOW)).toBe(true);
  });

  it('is due again after a second cooldown, because dismissals are uncapped', (): void => {
    expect(isPromptDue(NOW - 30 * DAY_MS, NOW)).toBe(true);
  });
});

describe('profilePromptStorageKey', (): void => {
  it('scopes the key to the account, so two users on one device do not share it', (): void => {
    expect(profilePromptStorageKey('user_1')).toBe('ganapps:profile-prompt:user_1');
    expect(profilePromptStorageKey('user_2')).not.toBe(profilePromptStorageKey('user_1'));
  });
});
