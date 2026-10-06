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
      <View className={`flex-1 bg-background${isDark ? ' dark' : ''}`} style={{ flex: 1 }}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        {children}
      </View>
    </NavigationThemeProvider>
  );
}
