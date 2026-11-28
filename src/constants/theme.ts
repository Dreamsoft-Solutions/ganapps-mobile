export const Colors = {
  light: {
    background: '#f3f6f4',
    foreground: '#0a1a14',
    card: '#ffffff',
    'card-foreground': '#0a1a14',
    popover: '#ffffff',
    'popover-foreground': '#0a1a14',
    primary: '#22c55e',
    'primary-foreground': '#052e16',
    'primary-text': '#166534',
    'brand-lime': '#69af01',
    like: '#dc2626',
    save: '#a16207',
    secondary: '#1f2937',
    'secondary-foreground': '#ffffff',
    muted: '#e9efec',
    'muted-foreground': '#56665f',
    accent: '#e9efec',
    'accent-foreground': '#1f2937',
    destructive: '#b91c1c',
    'destructive-foreground': '#ffffff',
    info: '#dbeafe',
    'info-foreground': '#1e40af',
    warning: '#fef3c7',
    'warning-foreground': '#78350f',
    notice: '#ede9fe',
    'notice-foreground': '#5b21b6',
    border: '#d5ded9',
    input: '#7a8a83',
    ring: '#15803d',
    'glass-fill': 'rgba(255, 255, 255, 0.46)',
    'glass-fill-strong': 'rgba(255, 255, 255, 0.76)',
    'glass-fill-solid': '#f7faf8',
    'glass-ice': '#ffffff',
    mint: '#16a34a',
    'glass-rim': 'rgba(255, 255, 255, 0.72)',
    'glass-highlight': 'rgba(255, 255, 255, 0.90)',
    'glass-lens': 'rgba(255, 255, 255, 0.78)',
    'glass-tint-primary': 'rgba(34, 197, 94, 0.22)',
    'on-glass-primary': '#14532d',
    'on-glass-muted': '#3c4b45',
    scrim: 'rgba(10, 26, 20, 0.32)',
    'primary-glow': 'rgba(34, 197, 94, 0.35)',
    glow: 'rgba(34, 197, 94, 0.14)',
    'glow-lime': 'rgba(105, 175, 1, 0.10)',
    'bezel-sheen': 'rgba(255, 255, 255, 0.55)',
    'map-land': '#eef1ec',
    'map-block': '#e2e6df',
    'map-road': '#ffffff',
    'map-road-major': '#f6f1e4',
    'map-water': '#a9d8ee',
    'map-park': '#cfe8c9',
    'map-label': '#6b7280',
  },
  dark: {
    background: '#061a22',
    foreground: '#eef6f2',
    card: '#0d252e',
    'card-foreground': '#eef6f2',
    popover: '#102c36',
    'popover-foreground': '#eef6f2',
    primary: '#22c55e',
    'primary-foreground': '#052e16',
    'primary-text': '#4ade80',
    'brand-lime': '#9bd300',
    like: '#f87171',
    save: '#facc15',
    secondary: '#1d3a44',
    'secondary-foreground': '#eef6f2',
    muted: '#12303a',
    'muted-foreground': '#9fb7b4',
    accent: '#12303a',
    'accent-foreground': '#eef6f2',
    destructive: '#f87171',
    'destructive-foreground': '#2a0a0a',
    info: '#172554',
    'info-foreground': '#93c5fd',
    warning: '#451a03',
    'warning-foreground': '#fcd34d',
    notice: '#2e1065',
    'notice-foreground': '#c4b5fd',
    border: '#1f3d47',
    input: '#4f727a',
    ring: '#4ade80',
    'glass-fill': 'rgba(9, 32, 40, 0.42)',
    'glass-fill-strong': 'rgba(9, 32, 40, 0.66)',
    'glass-fill-solid': '#0c242d',
    'glass-ice': '#e6fff5',
    mint: '#86efac',
    'glass-rim': 'rgba(255, 255, 255, 0.14)',
    'glass-highlight': 'rgba(255, 255, 255, 0.24)',
    'glass-lens': 'rgba(255, 255, 255, 0.14)',
    'glass-tint-primary': 'rgba(34, 197, 94, 0.30)',
    'on-glass-primary': '#bbf7d0',
    'on-glass-muted': '#cddcd9',
    scrim: 'rgba(3, 12, 16, 0.60)',
    'primary-glow': 'rgba(34, 197, 94, 0.45)',
    glow: 'rgba(74, 222, 128, 0.30)',
    'glow-lime': 'rgba(155, 211, 0, 0.14)',
    'bezel-sheen': 'rgba(255, 255, 255, 0.42)',
    'map-land': '#0b2028',
    'map-block': '#10272f',
    'map-road': '#1b3a44',
    'map-road-major': '#2a4f5a',
    'map-water': '#072d3d',
    'map-park': '#0f3326',
    'map-label': '#6f8f95',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light;

/**
 * Themed shadows, one string per token in `docs/design/tokens.json`. This is the only
 * themed shadow source: NativeWind cannot theme `shadow-*` classes, so apply a value as
 * `style={{ boxShadow: Shadows[theme].glass }}`. React Native parses inset and multi-layer strings.
 */
export const Shadows = {
  light: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.10), 0 2px 4px -2px rgba(0, 0, 0, 0.10)',
    glass:
      'inset 0 0 0 1px rgba(16, 48, 36, 0.07), inset 0 3px 5px -2px rgba(255, 255, 255, 1), inset 0 -4px 10px -3px rgba(22, 163, 74, 0.16), inset 0 0 28px 2px rgba(255, 255, 255, 0.55), 0 18px 36px -18px rgba(16, 48, 36, 0.40)',
    island:
      'inset 0 0 0 1px rgba(16, 48, 36, 0.08), inset 0 4px 6px -2px rgba(255, 255, 255, 1), inset 0 -6px 14px -4px rgba(22, 163, 74, 0.18), inset 0 0 40px 4px rgba(255, 255, 255, 0.60), 0 26px 52px -22px rgba(16, 48, 36, 0.42), 0 2px 6px rgba(16, 48, 36, 0.08)',
    lens: 'inset 0 2px 3px -1px rgba(255, 255, 255, 1), inset 0 -3px 6px -2px rgba(22, 163, 74, 0.20), 0 0 16px rgba(34, 197, 94, 0.22), 0 6px 14px -8px rgba(16, 48, 36, 0.35)',
    bezel:
      'inset 0 1px 0 rgba(255, 255, 255, 0.75), inset 0 -6px 12px -4px rgba(255, 255, 255, 0.30), 0 1px 2px rgba(16, 48, 36, 0.14)',
    'bezel-pressed': 'inset 0 2px 5px rgba(16, 48, 36, 0.22), inset 0 0 0 1px rgba(16, 48, 36, 0.10)',
    well: 'inset 0 2px 5px rgba(16, 48, 36, 0.12), inset 0 -1px 0 rgba(255, 255, 255, 0.9)',
  },
  dark: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.30)',
    md: '0 6px 16px -4px rgba(0, 0, 0, 0.45)',
    glass:
      'inset 0 0 0 1px rgba(230, 255, 245, 0.08), inset 0 3px 5px -2px rgba(255, 255, 255, 0.50), inset 0 -4px 10px -3px rgba(134, 239, 172, 0.36), inset 0 0 28px 2px rgba(74, 222, 128, 0.14), 0 20px 40px -20px rgba(0, 8, 12, 0.85)',
    island:
      'inset 0 0 0 1px rgba(230, 255, 245, 0.10), inset 0 4px 6px -2px rgba(255, 255, 255, 0.55), inset 0 -6px 14px -4px rgba(134, 239, 172, 0.40), inset 0 0 40px 4px rgba(74, 222, 128, 0.16), 0 28px 56px -22px rgba(0, 8, 12, 0.90), 0 2px 6px rgba(0, 8, 12, 0.30)',
    lens: 'inset 0 2px 3px -1px rgba(255, 255, 255, 0.60), inset 0 -3px 6px -2px rgba(134, 239, 172, 0.45), 0 0 18px rgba(74, 222, 128, 0.30), 0 6px 14px -8px rgba(0, 8, 12, 0.80)',
    bezel:
      'inset 0 1px 0 rgba(255, 255, 255, 0.60), inset 0 -6px 12px -4px rgba(230, 255, 245, 0.34), 0 1px 2px rgba(0, 8, 12, 0.35)',
    'bezel-pressed': 'inset 0 2px 5px rgba(0, 8, 12, 0.45), inset 0 0 0 1px rgba(255, 255, 255, 0.08)',
    well: 'inset 0 2px 5px rgba(0, 0, 0, 0.45), inset 0 -1px 0 rgba(255, 255, 255, 0.08)',
  },
} as const;

/**
 * Rim ring width in dp by surface size. A thick rim swallows a small control.
 */
export const Rim = {
  hair: 1,
  sm: 1.5,
  md: 2,
  lg: 2.5,
} as const;

/**
 * Backdrop blur radii from the web reference. The app does not read them: live glass bends the map instead
 * of frosting it (`GLASS_BACKDROP_BLUR` in `GlassMaterial`).
 */
export const Blur = {
  thin: 12,
  regular: 22,
  thick: 40,
} as const;

/**
 * Backdrop saturation boost from the web reference. The app does not read it.
 */
export const GLASS_SATURATE = 1.8;

export const Spacing = {
  base: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  touch: 48,
  'margin-mobile': 16,
  'gutter-mobile': 12,
  'island-inset': 12,
  'tabbar-clearance': 96,
} as const;

export const BorderRadius = {
  sm: 4,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  full: 9999,
} as const;

/**
 * Allo Ganapps font families, for styles set outside `className` (for example
 * Markdown style maps). Each weight is its own file, so set the family and
 * leave `fontWeight` unset: Android cannot pick a weight inside one family.
 */
export const Fonts = {
  regular: 'AlloGanapps-Regular',
  medium: 'AlloGanapps-Medium',
  semibold: 'AlloGanapps-SemiBold',
  bold: 'AlloGanapps-Bold',
} as const;
