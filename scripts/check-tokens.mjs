/**
 * Headless parity check for the Ganapps Glass design tokens.
 *
 * Usage: node scripts/check-tokens.mjs [--docs] [--source <path>]
 *
 * Compares docs/design/tokens.json with src/global.css, src/constants/theme.ts and
 * tailwind.config.js (and, with --docs, docs/DESIGN.md). Prints one FAIL line per
 * mismatch and exits 1. Prints OK with counts and exits 0 when everything agrees.
 * A missing module while loading tailwind.config.js prints SETUP and exits 2.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const THEMES = ['light', 'dark'];
const failures = [];

/**
 * Records one mismatch.
 * @param {string} what
 */
const fail = (what) => {
  failures.push(what);
};

/**
 * Normalises a value for comparison: lower-case, collapsed whitespace and every
 * numeric literal parsed as a float with no unit px (so 0.90 equals 0.9 and 0px equals 0).
 * @param {unknown} value
 * @returns {string}
 */
const norm = (value) =>
  String(value)
    .toLowerCase()
    .replace(/(?<![\w#.])-?(?:\d+\.?\d*|\.\d+)/g, (m) => String(Number.parseFloat(m)))
    .replace(/(\d)px\b/g, '$1')
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ',')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim();

/**
 * @param {string} file
 * @returns {string}
 */
const read = (file) => readFileSync(path.resolve(ROOT, file), 'utf8');

/**
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
const deepEqual = (a, b) => {
  if (a === b) {
    return true;
  }
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }
  if (Array.isArray(a) !== Array.isArray(b)) {
    return false;
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  return keysA.length === keysB.length && keysA.every((k) => k in b && deepEqual(a[k], b[k]));
};

/**
 * Returns the text between the braces of the first object literal that follows `start`.
 * @param {string} src
 * @param {RegExp} start
 * @returns {string | null}
 */
const extractBraces = (src, start) => {
  const match = start.exec(src);
  if (!match) {
    return null;
  }
  const from = match.index + match[0].length;
  let depth = 1;
  for (let i = from; i < src.length; i++) {
    if (src[i] === '{') {
      depth++;
    } else if (src[i] === '}') {
      depth--;
      if (depth === 0) {
        return src.slice(from, i);
      }
    }
  }
  return null;
};

/**
 * Reads `key: 'value'` and `key: 12` pairs from an object body (the key and value may be on
 * separate lines).
 * @param {string} body
 * @returns {Map<string, string>}
 */
const parsePairs = (body) => {
  const pairs = new Map();
  const re = /(?:'([^']+)'|"([^"]+)"|([A-Za-z_][\w]*))\s*:\s*(?:'([^']*)'|"([^"]*)"|(-?\d+\.?\d*))\s*(?:,|$)/gm;
  for (const m of body.matchAll(re)) {
    pairs.set(m[1] ?? m[2] ?? m[3], m[4] ?? m[5] ?? m[6]);
  }
  return pairs;
};

/**
 * @param {Record<string, Record<string, string>>} tokens
 * @param {string} name
 * @param {string} theme
 * @returns {string}
 */
const resolveColor = (tokens, name, theme) => {
  const seen = new Set();
  let current = tokens.find((t) => t.name === name);
  let value = current.value[theme];
  while (/^\{.+\}$/.test(value)) {
    const ref = value.slice(1, -1);
    if (seen.has(ref)) {
      throw new Error(`reference cycle at ${ref}`);
    }
    seen.add(ref);
    current = tokens.find((t) => t.name === ref);
    value = current.value[theme];
  }
  return value;
};

/**
 * @param {string} label
 * @param {unknown} actual
 * @param {unknown} expected
 */
const expectEqual = (label, actual, expected) => {
  if (actual === undefined) {
    fail(`${label} is missing (expected ${expected})`);
  } else if (norm(actual) !== norm(expected)) {
    fail(`${label} is ${actual} (expected ${expected})`);
  }
};

const args = process.argv.slice(2);
const checkDocs = args.includes('--docs');
const sourceIdx = args.indexOf('--source');
const sourcePath = sourceIdx === -1 ? null : args[sourceIdx + 1];

const tokens = JSON.parse(read('docs/design/tokens.json'));
const colorTokens = tokens.color.tokens;
let checks = 0;

if (sourceIdx !== -1) {
  if (!sourcePath) {
    fail('--source needs a path');
  } else {
    const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
    checks++;
    if (!deepEqual(source, tokens)) {
      fail(`docs/design/tokens.json differs from ${sourcePath}`);
    }
  }
}

const css = read('src/global.css').replace(/\/\*[\s\S]*?\*\//g, '');
const cssVars = { light: new Map(), dark: new Map() };
for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const selector = m[1].trim();
  const theme = selector.includes(':root') ? 'light' : selector.startsWith('.dark') ? 'dark' : null;
  if (!theme) {
    continue;
  }
  for (const decl of m[2].split(';')) {
    const idx = decl.indexOf(':');
    if (idx > 0 && decl.trim().startsWith('--')) {
      cssVars[theme].set(decl.slice(0, idx).trim(), decl.slice(idx + 1).trim());
    }
  }
}
for (const token of colorTokens) {
  for (const theme of THEMES) {
    checks++;
    expectEqual(
      `global.css ${theme} --${token.name}`,
      cssVars[theme].get(`--${token.name}`),
      resolveColor(colorTokens, token.name, theme),
    );
  }
}

const themeSrc = read('src/constants/theme.ts');
const readThemeObject = (name) => {
  const body = extractBraces(themeSrc, new RegExp(`export const ${name}\\b[^=]*=\\s*\\{`));
  if (body === null) {
    fail(`theme.ts does not export ${name}`);
  }
  return body ?? '';
};
const colorsBody = readThemeObject('Colors');
const shadowsBody = readThemeObject('Shadows');
const perTheme = (body, theme) => parsePairs(extractBraces(body, new RegExp(`\\b${theme}\\s*:\\s*\\{`)) ?? '');
for (const theme of THEMES) {
  const themeColors = perTheme(colorsBody, theme);
  for (const token of colorTokens) {
    checks++;
    expectEqual(
      `theme.ts Colors.${theme}['${token.name}']`,
      themeColors.get(token.name),
      resolveColor(colorTokens, token.name, theme),
    );
  }
  const themeShadows = perTheme(shadowsBody, theme);
  for (const token of tokens.shadow.tokens) {
    const key = token.name.replace(/^shadow-/, '');
    checks++;
    expectEqual(`theme.ts Shadows.${theme}['${key}']`, themeShadows.get(key), token.value[theme]);
  }
}

let tailwind;
try {
  tailwind = createRequire(import.meta.url)(path.resolve(ROOT, 'tailwind.config.js'));
} catch (error) {
  console.log(`SETUP ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}
const extend = tailwind.theme?.extend ?? {};

/**
 * Flattens nested Tailwind colour keys: primary.DEFAULT is primary, primary.text is primary-text.
 * @param {Record<string, unknown>} colors
 * @returns {Map<string, string>}
 */
const flattenColors = (colors) => {
  const flat = new Map();
  for (const [key, value] of Object.entries(colors)) {
    if (typeof value === 'string') {
      flat.set(key, value);
    } else if (value && typeof value === 'object') {
      for (const [sub, inner] of Object.entries(value)) {
        flat.set(sub === 'DEFAULT' ? key : `${key}-${sub}`, inner);
      }
    }
  }
  return flat;
};
const twColors = flattenColors(extend.colors ?? {});
for (const token of colorTokens) {
  checks++;
  const actual = twColors.get(token.name);
  if (actual !== `var(--${token.name})`) {
    fail(`tailwind.config.js colors '${token.name}' is ${actual} (expected var(--${token.name}))`);
  }
}

for (const key of ['sm', 'md']) {
  checks++;
  const value = extend.boxShadow?.[key];
  if (typeof value !== 'string' || value.includes('var(')) {
    fail(`tailwind.config.js boxShadow.${key} must be a literal without var() (is ${value})`);
  }
}

const themeScale = (name) => parsePairs(readThemeObject(name));
const scales = [
  {
    prefix: 'space-',
    tokens: tokens.spacing.tokens,
    tw: extend.spacing,
    ts: themeScale('Spacing'),
    twLabel: 'spacing',
    tsLabel: 'Spacing',
  },
  {
    prefix: 'radius-',
    tokens: tokens.radius.tokens,
    tw: extend.borderRadius,
    ts: themeScale('BorderRadius'),
    twLabel: 'borderRadius',
    tsLabel: 'BorderRadius',
  },
  {
    prefix: 'rim-',
    tokens: tokens.rim.tokens,
    tw: extend.borderWidth,
    ts: themeScale('Rim'),
    twLabel: 'borderWidth',
    tsLabel: 'Rim',
    twKey: (k) => `rim-${k}`,
  },
  { prefix: 'blur-', tokens: tokens.blur.tokens, tw: null, ts: themeScale('Blur'), tsLabel: 'Blur' },
];
for (const scale of scales) {
  for (const token of scale.tokens) {
    const key = token.name.slice(scale.prefix.length);
    if (scale.tw) {
      checks++;
      const twKey = scale.twKey ? scale.twKey(key) : key;
      expectEqual(`tailwind.config.js ${scale.twLabel}['${twKey}']`, scale.tw[twKey], token.value);
    }
    checks++;
    expectEqual(`theme.ts ${scale.tsLabel}['${key}']`, scale.ts.get(key), token.value);
  }
}

const saturate = tokens.saturate.tokens.find((t) => t.name === 'glass-saturate');
const saturateMatch = /GLASS_SATURATE\b[^=]*=\s*(-?\d+\.?\d*)/.exec(themeSrc);
checks++;
expectEqual('theme.ts GLASS_SATURATE', saturateMatch?.[1], String(Number.parseFloat(saturate.value) / 100));

const typeStyles = tokens.type.groups.flatMap((group) => group.styles);
const twFontSize = extend.fontSize ?? {};
for (const style of typeStyles) {
  const entry = twFontSize[style.name];
  checks++;
  if (!Array.isArray(entry)) {
    fail(`tailwind fontSize['${style.name}'] is missing`);
    continue;
  }
  const [size, meta] = entry;
  expectEqual(`tailwind fontSize['${style.name}'] size`, size, style.fontSize);
  for (const key of ['lineHeight', 'fontWeight', 'letterSpacing']) {
    checks++;
    expectEqual(`tailwind fontSize['${style.name}'].${key}`, meta?.[key], String(style[key]));
  }
}
const twFamilies = extend.fontFamily ?? {};
for (const font of tokens.type.fonts.filter((f) => f.family === 'Allo Ganapps')) {
  const file = path.basename(font.file, path.extname(font.file));
  checks++;
  if (!Object.values(twFamilies).some((list) => Array.isArray(list) && list[0] === file)) {
    fail(`tailwind fontFamily has no family for ${file}`);
  }
}

if (checkDocs) {
  const docs = norm(read('docs/DESIGN.md'));
  const rawDocs = read('docs/DESIGN.md').toLowerCase();
  for (const token of colorTokens) {
    checks++;
    if (!rawDocs.includes(token.name)) {
      fail(`docs/DESIGN.md does not mention color token ${token.name}`);
    }
    for (const theme of THEMES) {
      checks++;
      const value = resolveColor(colorTokens, token.name, theme);
      if (!docs.includes(norm(value))) {
        fail(`docs/DESIGN.md is missing ${theme} value of ${token.name}: ${value}`);
      }
    }
  }
  for (const token of tokens.shadow.tokens) {
    checks++;
    if (!rawDocs.includes(token.name)) {
      fail(`docs/DESIGN.md does not mention shadow token ${token.name}`);
    }
  }
}

if (failures.length > 0) {
  for (const what of failures) {
    console.log(`FAIL ${what}`);
  }
  process.exit(1);
}
console.log(
  `OK: ${colorTokens.length} colors x 2 themes, ${tokens.shadow.tokens.length} shadows, ` +
    `${tokens.spacing.tokens.length} spacing, ${tokens.radius.tokens.length} radii, ` +
    `${tokens.rim.tokens.length} rims, ${tokens.blur.tokens.length} blurs (${checks} checks)` +
    `${checkDocs ? ', docs' : ''}${sourcePath ? ', source' : ''}`,
);
