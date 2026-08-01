export const Colors = {
  light: {
    background: '#ffffff',
    foreground: '#000000',
    card: '#ffffff',
    'card-foreground': '#000000',
    popover: '#ffffff',
    'popover-foreground': '#000000',
    primary: '#22c55e',
    'primary-foreground': '#ffffff',
    secondary: '#1f2937',
    'secondary-foreground': '#ffffff',
    muted: '#f4f4f5',
    'muted-foreground': '#6b7280',
    accent: '#f4f4f5',
    'accent-foreground': '#1f2937',
    destructive: '#ef4444',
    'destructive-foreground': '#ffffff',
    border: '#d1d5db',
    input: '#d1d5db',
    ring: '#22c55e',
  },
  dark: {
    background: '#09090b',
    foreground: '#fafafa',
    card: '#18181b',
    'card-foreground': '#fafafa',
    popover: '#18181b',
    'popover-foreground': '#fafafa',
    primary: '#22c55e',
    'primary-foreground': '#ffffff',
    secondary: '#1f2937',
    'secondary-foreground': '#fafafa',
    muted: '#27272a',
    'muted-foreground': '#a1a1aa',
    accent: '#27272a',
    'accent-foreground': '#fafafa',
    destructive: '#b91c1c',
    'destructive-foreground': '#fafafa',
    border: '#27272a',
    input: '#27272a',
    ring: '#22c55e',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light;

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
