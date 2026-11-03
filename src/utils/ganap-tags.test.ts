import { describe, expect, it } from '@jest/globals';
import { GANAP_MAIN_TAGS } from '@/constants/ganap-tags';
import { collectMainTags, getGanapMainTag } from './ganap-tags';

describe('GANAP_MAIN_TAGS', (): void => {
  it('matches the ten categories the web create form enforces, in its order', (): void => {
    expect(GANAP_MAIN_TAGS).toEqual([
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
    ]);
  });
});

describe('getGanapMainTag', (): void => {
  it('reads the main tag from position zero', (): void => {
    expect(getGanapMainTag(['Sports & Fitness', 'Running', '16K'])).toBe('Sports & Fitness');
  });

  it('returns null when the first tag is not a main category or there are no tags', (): void => {
    expect(getGanapMainTag(['concert', 'Music & Entertainment'])).toBeNull();
    expect(getGanapMainTag([])).toBeNull();
  });
});

describe('collectMainTags', (): void => {
  it('keeps each main category once, in the fixed order, and never a sub tag', (): void => {
    const tags = collectMainTags([
      { tags: ['Sports & Fitness', 'Running', '10K'] },
      { tags: ['Food & Drink', 'Health & Wellness'] },
      { tags: ['Music & Entertainment', 'acoustic'] },
      { tags: ['Sports & Fitness', '5K'] },
      { tags: ['legacy-tag'] },
      { tags: [] },
    ]);

    expect(tags).toEqual(['Music & Entertainment', 'Food & Drink', 'Sports & Fitness']);
  });
});
