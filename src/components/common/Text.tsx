import type { ReactElement } from 'react';
import { Text as RNText, type TextProps } from 'react-native';
import { Colors } from '@/constants/theme';

/** Matches any font-family utility a caller may supply, e.g. `font-inter-bold`. */
const FONT_FAMILY_CLASS = /(?:^|\s)font-(?:inter-\w+|mono)(?:\s|$)/;

/** Matches a semantic text colour utility, e.g. `text-destructive-foreground` or `text-primary-text/70`. */
const TEXT_COLOR_CLASS = new RegExp(`(?:^|\\s)text-(?:${Object.keys(Colors.light).join('|')})(?:/\\d+)?(?:\\s|$)`);

/**
 * Text primitive that uses the design system foreground color and sans font.
 *
 * The defaults `font-sans` and `text-foreground` are applied only when the
 * caller has not chosen a family or colour of its own. NativeWind resolves two
 * classes for the same property by stylesheet order, not by their order in
 * `className`, so keeping both would let the default win: every weight utility
 * would render as regular, and a label such as `text-destructive-foreground`
 * would render in `foreground`.
 *
 * @param props - React Native Text props plus an optional className override.
 * @returns A themed text element.
 */
export function Text({ className, ...props }: TextProps): ReactElement {
  const classes: string = className ?? '';
  const family: string = FONT_FAMILY_CLASS.test(classes) ? '' : 'font-sans';
  const color: string = TEXT_COLOR_CLASS.test(classes) ? '' : 'text-foreground';

  return <RNText className={`${family} ${color} ${classes}`} {...props} />;
}
