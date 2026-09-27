import { isValidFriendCode, normalizeFriendCode } from '@/utils/friends';

const GANAP_SHARE_ID_PATTERN: RegExp = /^[A-Za-z0-9_-]{1,128}$/;

function isPrivateIpv4Address(hostname: string): boolean {
  const octets: number[] = hostname.split('.').map((octet: string): number => Number(octet));
  if (
    octets.length !== 4 ||
    octets.some((octet: number): boolean => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return false;
  }

  const [first, second] = octets;
  return (
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254) ||
    (first === 100 && second >= 64 && second <= 127)
  );
}

function isLocalDevelopmentHost(hostname: string): boolean {
  const normalizedHostname: string = hostname
    .toLowerCase()
    .replace(/\.$/, '')
    .replace(/^\[|\]$/g, '');
  return (
    normalizedHostname === 'localhost' ||
    normalizedHostname.endsWith('.localhost') ||
    normalizedHostname.endsWith('.local') ||
    normalizedHostname === '::1' ||
    (normalizedHostname.includes(':') && normalizedHostname.startsWith('fc')) ||
    (normalizedHostname.includes(':') && normalizedHostname.startsWith('fd')) ||
    normalizedHostname.startsWith('fe80:') ||
    isPrivateIpv4Address(normalizedHostname)
  );
}

function getShareWebOrigin(): URL {
  const configuredUrl: string | undefined = process.env.EXPO_PUBLIC_WEB_URL;
  if (!configuredUrl) {
    throw new Error('Set EXPO_PUBLIC_WEB_URL before creating share links.');
  }

  let origin: URL;
  try {
    origin = new URL(configuredUrl);
  } catch {
    throw new Error('EXPO_PUBLIC_WEB_URL must be a valid HTTP or HTTPS origin.');
  }

  if (
    (origin.protocol !== 'https:' && origin.protocol !== 'http:') ||
    origin.username !== '' ||
    origin.password !== '' ||
    origin.pathname !== '/' ||
    origin.search !== '' ||
    origin.hash !== ''
  ) {
    throw new Error('EXPO_PUBLIC_WEB_URL must be an HTTP or HTTPS origin without credentials or a path.');
  }

  if (origin.protocol === 'http:' && !isLocalDevelopmentHost(origin.hostname)) {
    throw new Error('EXPO_PUBLIC_WEB_URL must use HTTPS unless it points to a local development host.');
  }

  return origin;
}

function buildShareUrl(path: 'friends' | 'ganaps', identifier: string): string {
  const url: URL = new URL(`/${path}/${encodeURIComponent(identifier)}`, getShareWebOrigin());
  return url.toString();
}

/**
 * Checks whether a Ganap identifier is safe to use as one URL path segment.
 *
 * @param id - Candidate Ganap identifier.
 * @returns `true` when the identifier contains only URL-safe identifier characters.
 */
export function isValidGanapShareId(id: string): boolean {
  return GANAP_SHARE_ID_PATTERN.test(id);
}

/**
 * Builds the canonical HTTPS share URL for a Friend Code.
 *
 * Lowercase letters and readability separators are normalized before the URL is built.
 * Local HTTP origins are accepted for development; public HTTP origins are rejected.
 *
 * @param code - Raw or formatted Friend Code.
 * @returns A URL ending in `/friends/<code>`.
 * @throws When the Friend Code is invalid or `EXPO_PUBLIC_WEB_URL` is unsafe or missing.
 */
export function buildFriendShareUrl(code: string): string {
  const normalizedCode: string = normalizeFriendCode(code);
  if (!isValidFriendCode(normalizedCode)) {
    throw new Error('Friend Code must be a valid 12-character code.');
  }

  return buildShareUrl('friends', normalizedCode);
}

/**
 * Builds the canonical HTTPS share URL for a Ganap.
 *
 * Local HTTP origins are accepted for development; public HTTP origins are rejected.
 *
 * @param id - Ganap identifier.
 * @returns A URL ending in `/ganaps/<id>`.
 * @throws When the identifier is invalid or `EXPO_PUBLIC_WEB_URL` is unsafe or missing.
 */
export function buildGanapShareUrl(id: string): string {
  if (!isValidGanapShareId(id)) {
    throw new Error('Ganap ID must contain only letters, numbers, hyphens, or underscores.');
  }

  return buildShareUrl('ganaps', id);
}
