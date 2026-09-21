import resolveConfig from 'tailwindcss/resolveConfig';
import tailwindConfig from '../../tailwind.config.js';

/**
 * The pixel value NativeWind substitutes for `1rem` when it compiles Tailwind
 * classes for React Native.
 *
 * This is NativeWind's own default (`inlineRem = 14` in its Metro plugin), not
 * the CSS default of 16, and `metro.config.js` does not override it. Every class
 * on Tailwind's default numeric scale therefore renders at 0.875x the value its
 * documentation states: `w-12` is 3rem, which is 42dp here rather than 48dp.
 *
 * The named tokens in `tailwind.config.js` are declared in literal px and are
 * unaffected, which is why a touch target sizes itself from `touch` rather than
 * from the numeric scale. See DS-119 and ADR 0005.
 */
export const NATIVEWIND_REM_PX: number = 14;

const resolved = resolveConfig(tailwindConfig);

/**
 * Resolves a Tailwind spacing scale key to the size it actually renders at.
 *
 * Reads the real resolved theme rather than reimplementing the scale, so a
 * change to `tailwind.config.js` shows up here instead of silently disagreeing
 * with it.
 *
 * @param key - A spacing scale key, such as `'12'`, `'touch'`, or `'xs'`.
 * @returns The rendered size in dp.
 * @throws When the key is absent from the theme, or carries a unit that is
 * neither `px` nor `rem`.
 */
export function spacingDp(key: string): number {
  const value: unknown = (resolved.theme?.spacing as Record<string, string> | undefined)?.[key];

  if (typeof value !== 'string') {
    throw new Error(`No spacing value for "${key}" in the resolved Tailwind theme`);
  }

  if (value.endsWith('px')) {
    return Number.parseFloat(value);
  }

  if (value.endsWith('rem')) {
    return Number.parseFloat(value) * NATIVEWIND_REM_PX;
  }

  throw new Error(`Spacing "${key}" has unit this helper cannot convert: "${value}"`);
}

/** The sizing prefixes {@link classSizeDp} can read off a class string. */
export type TailwindSizePrefix = 'w' | 'h' | 'px' | 'py' | 'min-w' | 'min-h';

/**
 * Resolves the single sizing class in a class string to its rendered size.
 *
 * Accepts the prefixes a touch target uses — `w-`, `h-`, `min-w-`, `min-h-` —
 * and resolves the key through {@link spacingDp}, so an arbitrary token like
 * `w-touch` measures the same way `w-12` does.
 *
 * @param className - The full class string for a variant.
 * @param prefix - The sizing prefix to read, e.g. `'w'`, `'py'`, or `'min-h'`.
 * @returns The rendered size in dp.
 * @throws When the prefix does not appear in the class string.
 */
export function classSizeDp(className: string, prefix: TailwindSizePrefix): number {
  const match: RegExpMatchArray | null = className.match(new RegExp(`(?:^|\\s)${prefix}-([\\w.-]+)(?:\\s|$)`));

  if (match === null) {
    throw new Error(`No "${prefix}-" class found in "${className}"`);
  }

  return spacingDp(match[1]);
}

/**
 * Resolves the line height of whichever `text-` class in a class string names a
 * font size.
 *
 * A variant's class string also carries colour classes such as
 * `text-primary-foreground`, so this matches every `text-` token and keeps the
 * one the theme defines a font size for, rather than the first one it sees.
 *
 * @param className - The full class string for a variant.
 * @returns The line height in dp.
 * @throws When no `text-` token in the string names a font size, or its line
 * height carries a unit this helper cannot convert.
 */
export function classLineHeightDp(className: string): number {
  const fontSizes = resolved.theme?.fontSize as Record<string, unknown> | undefined;

  for (const match of className.matchAll(/(?:^|\s)text-([\w.-]+)(?:\s|$)/g)) {
    const entry: unknown = fontSizes?.[match[1]];

    if (entry === undefined) continue;

    const lineHeight: unknown = Array.isArray(entry)
      ? typeof entry[1] === 'object' && entry[1] !== null
        ? (entry[1] as { lineHeight?: unknown }).lineHeight
        : entry[1]
      : undefined;

    if (typeof lineHeight !== 'string') {
      throw new Error(`Font size "${match[1]}" has no readable line height`);
    }

    if (lineHeight.endsWith('px')) return Number.parseFloat(lineHeight);
    if (lineHeight.endsWith('rem')) return Number.parseFloat(lineHeight) * NATIVEWIND_REM_PX;

    throw new Error(`Line height for "${match[1]}" has unit this helper cannot convert: "${lineHeight}"`);
  }

  throw new Error(`No font-size class found in "${className}"`);
}
