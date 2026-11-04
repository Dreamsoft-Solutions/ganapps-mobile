import { GANAP_MAIN_TAGS } from '@/constants/ganap-tags';

/**
 * Reads a Ganap's main category from position zero of its tags.
 *
 * @param tags - The Ganap's tags, stored as `[mainTag, ...subTags]`
 * @returns The main category, or null when the first tag isn't one, as on untagged or older events
 */
export function getGanapMainTag(tags: readonly string[]): string | null {
  const first: string | undefined = tags[0];
  return first !== undefined && GANAP_MAIN_TAGS.includes(first) ? first : null;
}

/**
 * Lists the main categories used by at least one Ganap, ignoring every sub tag.
 *
 * @param ganaps - Ganaps whose tags to read
 * @returns Each main category once, in the fixed category order
 */
export function collectMainTags(ganaps: ReadonlyArray<{ tags: readonly string[] }>): string[] {
  const present = new Set<string>();
  for (const ganap of ganaps) {
    const mainTag: string | null = getGanapMainTag(ganap.tags);
    if (mainTag) present.add(mainTag);
  }
  return GANAP_MAIN_TAGS.filter((mainTag: string): boolean => present.has(mainTag));
}
