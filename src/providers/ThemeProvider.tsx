import { StatusBar } from 'expo-status-bar';
import type { ReactElement, ReactNode } from 'react';
import { useColorScheme, View } from 'react-native';
import { useThemeStore } from '@/store/theme.store';

interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * Resolves the user's theme preference against the device color scheme and applies
 * it to the NativeWind theme via the `.dark` class.
 *
 * Renders nothing until the theme store has hydrated so a persisted dark
 * preference cannot flash light on a cold start.
 *
 * @param props - Provider children.
 * @returns The children wrapped in a view with the resolved theme class.
 */
export function ThemeProvider({ children }: ThemeProviderProps): ReactElement | null {
  const mode = useThemeStore((s) => s.mode);
  const isHydrated = useThemeStore((s) => s.isHydrated);
  const systemColorScheme = useColorScheme();
  const isDark = mode === 'dark' || (mode === 'system' && systemColorScheme === 'dark');

  if (!isHydrated) return null;

  return (
    <View className={`flex-1 ${isDark ? 'dark' : ''}`} style={{ flex: 1 }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {children}
    </View>
  );
}
