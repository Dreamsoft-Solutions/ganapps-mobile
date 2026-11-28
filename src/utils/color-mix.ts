interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

const HEX_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const FUNCTIONAL_PATTERN =
  /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*(?:,\s*(\d+(?:\.\d+)?)\s*)?\)$/i;

/**
 * Parses the colour forms `mix` accepts into straight (non-premultiplied) channels.
 *
 * @throws Error when the string is not `#rgb`, `#rrggbb`, `rgb()`, `rgba()` or `transparent`.
 */
function parseColor(input: string): Rgba {
  const color = input.trim();
  if (color.toLowerCase() === 'transparent') {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  const hex = HEX_PATTERN.exec(color);
  if (hex) {
    const digits = hex[1];
    const full =
      digits.length === 3
        ? digits
            .split('')
            .map((digit: string): string => digit + digit)
            .join('')
        : digits;
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
      a: 1,
    };
  }

  const functional = FUNCTIONAL_PATTERN.exec(color);
  if (functional) {
    const [, r, g, b, a] = functional;
    return {
      r: Math.min(Number(r), 255),
      g: Math.min(Number(g), 255),
      b: Math.min(Number(b), 255),
      a: a === undefined ? 1 : Math.min(Number(a), 1),
    };
  }

  throw new Error(`color-mix: unsupported colour "${input}"`);
}

/**
 * Mixes two colours the way CSS `color-mix(in srgb, color percent%, other)` does, with premultiplied
 * alpha, so a mix against `transparent` keeps the colour's channels and only lowers its alpha.
 *
 * @param color - First colour: `#rgb`, `#rrggbb`, `rgb()`, `rgba()` or `transparent`.
 * @param percent - Share of `color` in the result, from 0 to 100.
 * @param other - Second colour, in the same forms. Defaults to `transparent`.
 * @returns The mix as `rgba(r, g, b, a)` with channels rounded and alpha to 3 decimals.
 * @throws Error when either colour is in an unsupported form, or `percent` is outside 0 to 100.
 */
export function mix(color: string, percent: number, other: string = 'transparent'): string {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new RangeError(`color-mix: percent must be between 0 and 100, got ${percent}`);
  }

  const first = parseColor(color);
  const second = parseColor(other);
  const weightFirst = percent / 100;
  const weightSecond = 1 - weightFirst;

  const alpha = first.a * weightFirst + second.a * weightSecond;
  if (alpha === 0) {
    return 'rgba(0, 0, 0, 0)';
  }

  const channel = (a: number, b: number): number =>
    Math.round((a * first.a * weightFirst + b * second.a * weightSecond) / alpha);

  return `rgba(${channel(first.r, second.r)}, ${channel(first.g, second.g)}, ${channel(first.b, second.b)}, ${Number(alpha.toFixed(3))})`;
}
