import { z } from 'zod';

/** Returns a safe published website, without fetching it.
 * @param value - Explicit Business website
 * @returns HTTPS URL or null when absent or unsafe
 */
export function businessWebsiteUrl(value?: string | null): string | null {
  if (!value || value.length > 2048) return null;
  try {
    const url: URL = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Builds an email intent from the explicitly published Business email.
 * @param value - Public contact email; private account data must never be passed
 * @returns Encoded mailto URL or null
 */
export function businessEmailUrl(value?: string | null): string | null {
  return value && value.length <= 254 && z.email().safeParse(value).success
    ? `mailto:${encodeURIComponent(value)}`
    : null;
}
