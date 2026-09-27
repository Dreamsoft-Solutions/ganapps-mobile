import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { buildFriendShareUrl, buildGanapShareUrl, isValidGanapShareId } from './share-links';

describe('share link builders', (): void => {
  let originalWebUrl: string | undefined;

  beforeEach((): void => {
    originalWebUrl = process.env.EXPO_PUBLIC_WEB_URL;
  });

  afterEach((): void => {
    if (originalWebUrl === undefined) {
      delete process.env.EXPO_PUBLIC_WEB_URL;
    } else {
      process.env.EXPO_PUBLIC_WEB_URL = originalWebUrl;
    }
  });

  it('builds a canonical Friend Code URL and normalizes formatting', (): void => {
    process.env.EXPO_PUBLIC_WEB_URL = 'https://links.ganapps.test';

    expect(buildFriendShareUrl('0123-4567-89ab')).toBe('https://links.ganapps.test/friends/0123456789AB');
  });

  it('builds a canonical Ganap URL', (): void => {
    process.env.EXPO_PUBLIC_WEB_URL = 'https://links.ganapps.test/';

    expect(buildGanapShareUrl('event_123-abc')).toBe('https://links.ganapps.test/ganaps/event_123-abc');
  });

  it('allows private HTTP origins for local development', (): void => {
    process.env.EXPO_PUBLIC_WEB_URL = 'http://192.168.1.42:3000';

    expect(buildGanapShareUrl('event-123')).toBe('http://192.168.1.42:3000/ganaps/event-123');
  });

  it('rejects invalid identifiers and public HTTP origins', (): void => {
    process.env.EXPO_PUBLIC_WEB_URL = 'http://links.ganapps.test';

    expect((): string => buildFriendShareUrl('bad')).toThrow('valid 12-character code');
    expect((): string => buildGanapShareUrl('../event')).toThrow('Ganap ID');
    expect((): string => buildGanapShareUrl('event-123')).toThrow('must use HTTPS');
  });

  it('requires a configured safe origin', (): void => {
    delete process.env.EXPO_PUBLIC_WEB_URL;
    expect((): string => buildGanapShareUrl('event-123')).toThrow('Set EXPO_PUBLIC_WEB_URL');

    process.env.EXPO_PUBLIC_WEB_URL = 'https://links.ganapps.test/path';
    expect((): string => buildFriendShareUrl('0123456789AB')).toThrow('origin without credentials or a path');
  });

  it('validates Ganap identifiers as one safe path segment', (): void => {
    expect(isValidGanapShareId('event-123_abc')).toBe(true);
    expect(isValidGanapShareId('../event')).toBe(false);
    expect(isValidGanapShareId('')).toBe(false);
  });
});
