/** Interest option shown during profile setup and editing. */
export interface InterestOption {
  id: string;
  label: string;
}

/** Curated interest choices supported by the mobile profile form. */
export const INTEREST_OPTIONS: readonly InterestOption[] = [
  { id: 'food', label: 'Food' },
  { id: 'coffee', label: 'Coffee' },
  { id: 'study', label: 'Study' },
  { id: 'coworking', label: 'Coworking' },
  { id: 'sports', label: 'Sports' },
  { id: 'nightlife', label: 'Nightlife' },
  { id: 'travel', label: 'Travel' },
  { id: 'casual', label: 'Casual Hangout' },
];

const INTEREST_LABELS: Record<string, string> = {
  food: 'Food',
  coffee: 'Coffee',
  study: 'Study',
  coworking: 'Coworking',
  sports: 'Sports',
  nightlife: 'Nightlife',
  travel: 'Travel',
  casual: 'Casual Hangout',
};

/**
 * Returns a display label for an interest value received from the server.
 *
 * @param value - Stored interest identifier.
 * @returns A human-readable, emoji-free label.
 */
export function formatInterestLabel(value: string): string {
  return (
    INTEREST_LABELS[value] ??
    value
      .replaceAll('_', ' ')
      .replaceAll('-', ' ')
      .replace(/\b\w/g, (letter: string): string => letter.toUpperCase())
  );
}

/**
 * Combines curated interests with any values already stored for the User.
 *
 * @param selected - Existing interest identifiers.
 * @returns Options that preserve existing values during editing.
 */
export function getInterestOptions(selected: string[]): InterestOption[] {
  const knownIds = new Set(INTEREST_OPTIONS.map((option: InterestOption): string => option.id));
  const extraOptions = selected
    .filter((interest: string): boolean => !knownIds.has(interest))
    .map((interest: string): InterestOption => ({ id: interest, label: formatInterestLabel(interest) }));

  return [...INTEREST_OPTIONS, ...extraOptions];
}
