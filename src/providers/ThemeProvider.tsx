import type { ReactElement, ReactNode } from 'react';
import { useColorScheme, View } from 'react-native';

interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * Applies the device color scheme to the NativeWind theme.
 *
 * @param props - Provider children.
 * @returns The children wrapped in a view with the correct color scheme class.
 */
export function ThemeProvider({ children }: ThemeProviderProps): ReactElement {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View className={`flex-1 ${isDark ? 'dark' : ''}`} style={{ flex: 1 }}>
      {children}
    </View>
  );
}
