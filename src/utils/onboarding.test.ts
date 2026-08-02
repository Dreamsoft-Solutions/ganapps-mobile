import { describe, expect, it } from '@jest/globals';
import type { User } from '@/types/user.types';
import { needsOnboarding } from './onboarding';

/** Builds a user carrying only the fields the predicate reads. */
function userWith(overrides: Partial<User>): User {
  return {
    id: 'user_1',
    email: 'maria@example.com',
    username: 'maria',
    firstName: null,
    lastName: null,
    displayPicture: null,
    interests: [],
    isVerified: true,
    createdAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('needsOnboarding', () => {
  it('returns false when there is no user yet, so nothing redirects mid-load', () => {
    expect(needsOnboarding(null)).toBe(false);
  });

  it('returns true when lastName is null', () => {
    expect(needsOnboarding(userWith({ lastName: null }))).toBe(true);
  });

  it('returns true when lastName is an empty string', () => {
    expect(needsOnboarding(userWith({ lastName: '' }))).toBe(true);
  });

  it('returns true when lastName is only whitespace', () => {
    expect(needsOnboarding(userWith({ lastName: '   ' }))).toBe(true);
  });

  it('returns false once lastName is set', () => {
    expect(needsOnboarding(userWith({ firstName: 'Maria', lastName: 'Santos' }))).toBe(false);
  });

  it('returns true for a Google user given a firstName but no lastName', () => {
    expect(needsOnboarding(userWith({ firstName: 'Maria Santos', lastName: null }))).toBe(true);
  });

  it('ignores interests, which cannot distinguish "chose none" from "never asked"', () => {
    expect(needsOnboarding(userWith({ lastName: 'Santos', interests: [] }))).toBe(false);
  });
});
