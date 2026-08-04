import type { ReactElement } from 'react';
import { Text as RNText, type TextProps } from 'react-native';

/** Matches any font-family utility a caller may supply, e.g. `font-inter-bold`. */
const FONT_FAMILY_CLASS = /(?:^|\s)font-(?:inter-\w+|mono)(?:\s|$)/;

/**
 * Text primitive that uses the design system foreground color and sans font.
 *
 * The default `font-sans` is applied only when the caller has not chosen a
 * family of its own. Tailwind emits `.font-sans` after every `.font-inter-*`
 * utility, so keeping both would let the default win and render every weight
 * utility in the app as regular.
 *
 * @param props - React Native Text props plus an optional className override.
 * @returns A themed text element.
 */
export function Text({ className, ...props }: TextProps): ReactElement {
  const family: string = FONT_FAMILY_CLASS.test(className ?? '') ? '' : 'font-sans';

  return <RNText className={`${family} text-foreground ${className ?? ''}`} {...props} />;
}
