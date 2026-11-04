import '@/utils/icon-interop';

import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colorScheme } from 'nativewind';
import { type ReactElement, type ReactNode, useLayoutEffect, useMemo } from 'react';
import { View } from 'react-native';
import { Colors } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import { useThemeStore } from '@/store/theme.store';

interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * Resolves the user's theme preference against the device color scheme and applies
 * it to NativeWind's global color scheme.
 *
 * The root view always carries exactly one theme class, `light` or `dark`, and both
 * set the full palette in `global.css`. That keeps a CSS variable on the view from
 * its first render: react-native-css-interop re-wraps a view that gains variables
 * later, which remounts the whole navigation tree and threw the user from Settings
 * to the home screen on the first theme switch. Scoping the palette to the view also
 * keeps it independent of the native appearance, which a newly opened window can
 * reset while an explicit theme is chosen.
 *
 * Renders nothing until the theme store has hydrated so a persisted dark
 * preference cannot flash light on a cold start.
 *
 * @param props - Provider children.
 * @returns The children wrapped in a view with the resolved theme applied.
 */
export function ThemeProvider({ children }: ThemeProviderProps): ReactElement | null {
  const mode = useThemeStore((s) => s.mode);
  const isHydrated = useThemeStore((s) => s.isHydrated);
  const theme = useResolvedTheme();
  const isDark = theme === 'dark';
  const navigationTheme = useMemo(
    (): typeof DefaultTheme => ({
      ...(isDark ? DarkTheme : DefaultTheme),
      colors: {
        primary: Colors[theme].primary,
        background: Colors[theme].background,
        card: Colors[theme].card,
        text: Colors[theme].foreground,
        border: Colors[theme].border,
        notification: Colors[theme].primary,
      },
    }),
    [isDark, theme],
  );

  // Hydration must be triggered here rather than by a descendant: the `isHydrated`
  // gate below unmounts the whole tree, so a `hydrate()` call living under it would
  // never run and the app would hang on the splash screen forever.
  useLayoutEffect(() => {
    useThemeStore.getState().hydrate();
  }, []);

  useLayoutEffect(() => {
    colorScheme.set(mode);
  }, [mode]);

  if (!isHydrated) return null;

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <View className={`flex-1 bg-background ${isDark ? 'dark' : 'light'}`} style={{ flex: 1 }}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        {children}
      </View>
    </NavigationThemeProvider>
  );
}
