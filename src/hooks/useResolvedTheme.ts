import { useColorScheme } from 'react-native';
import { useThemeStore } from '@/store/theme.store';

/**
 * Resolves the user's stored theme preference against the device colour scheme.
 *
 * `'system'` defers to the device; `'light'` and `'dark'` win over it. This is the only
 * correct way to ask which theme is showing from outside a `className` — reading
 * `useColorScheme()` directly ignores an explicit override and desynchronises the component
 * from the `.dark` class that `ThemeProvider` applies.
 *
 * @returns The theme currently in effect.
 */
export function useResolvedTheme(): 'light' | 'dark' {
  const mode = useThemeStore((s) => s.mode);
  const systemColorScheme = useColorScheme();

  if (mode === 'system') return systemColorScheme === 'dark' ? 'dark' : 'light';
  return mode;
}
