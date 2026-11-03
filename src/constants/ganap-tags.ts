/**
 * The ten main categories a Ganap's first tag must be.
 *
 * Mirrors `EVENT_MAIN_TAGS` in `ganapps-web/src/lib/validation.ts`. Web ADR 0007 stores a
 * Ganap's tags as `[mainTag, ...subTags]`, with the main tag at position zero, and the web
 * create and edit forms only accept these ten values there. Keep the order in step with web.
 */
export const GANAP_MAIN_TAGS: readonly string[] = [
  'Music & Entertainment',
  'Arts & Culture',
  'Food & Drink',
  'Sports & Fitness',
  'Education & Workshops',
  'Business & Networking',
  'Technology & Gaming',
  'Community & Causes',
  'Health & Wellness',
  'Other',
];
