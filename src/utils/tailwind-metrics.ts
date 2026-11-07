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
