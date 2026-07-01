export const Colors = {
  light: {
    text: '#1a1c1c',
    textSecondary: '#3c4a3c',
    background: '#f9f9f9',
    surface: '#f9f9f9',
    surfaceContainer: '#eeeeee',
    surfaceContainerHigh: '#e8e8e8',
    surfaceContainerHighest: '#e2e2e2',
    primary: '#006e2a',
    primaryContainer: '#00c853',
    onPrimary: '#ffffff',
    onPrimaryContainer: '#004c1b',
    secondary: '#5e5e5e',
    secondaryContainer: '#e2e2e2',
    tertiary: '#9d4139',
    tertiaryContainer: '#ff8d81',
    error: '#ba1a1a',
    errorContainer: '#ffdad6',
    outline: '#6c7b6a',
    outlineVariant: '#bbcbb8',
  },
  dark: {
    text: '#f1f1f1',
    textSecondary: '#bbcbb8',
    background: '#1a1c1c',
    surface: '#2f3131',
    surfaceContainer: '#2f3131',
    surfaceContainerHigh: '#3c4a3c',
    surfaceContainerHighest: '#4a5a4a',
    primary: '#69ff87',
    primaryContainer: '#00531e',
    onPrimary: '#002108',
    onPrimaryContainer: '#69ff87',
    secondary: '#c6c6c6',
    secondaryContainer: '#474747',
    tertiary: '#ffb4ab',
    tertiaryContainer: '#7e2a24',
    error: '#ffb4ab',
    errorContainer: '#93000a',
    outline: '#bbcbb8',
    outlineVariant: '#3c4a3c',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Spacing = {
  base: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const BorderRadius = {
  sm: 4,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;
