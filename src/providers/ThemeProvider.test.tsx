import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { DefaultTheme, ThemeProvider as NavigationThemeProvider, useTheme } from 'expo-router';
import { cssInterop } from 'nativewind';
import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { registerCSS } from 'react-native-css-interop/test';
import { Colors } from '@/constants/theme';
import { useThemeStore } from '@/store/theme.store';
import { ThemeProvider } from './ThemeProvider';

jest.mock('@/utils/icon-interop', (): object => ({}));

cssInterop(View, { className: 'style' });

beforeEach((): void => {
  registerCSS(`${readFileSync(join(__dirname, '../global.css'), 'utf8')}
.bg-background { background-color: var(--background); }`);
});

function NavigationThemeProbe(): ReactElement {
  const theme = useTheme();
  return (
    <View testID="themed-surface" className="bg-background">
      <Text testID="navigation-theme">{[theme.dark, theme.colors.card, theme.colors.text].join('|')}</Text>
    </View>
  );
}

describe('native navigation theme', (): void => {
  it.each(['light', 'dark'] as const)('matches the resolved %s surfaces and header text', async (mode:
    | 'light'
    | 'dark'): Promise<void> => {
    useThemeStore.setState({ mode, isHydrated: true });
    const screen = await render(
      <NavigationThemeProvider value={DefaultTheme}>
        <ThemeProvider>
          <NavigationThemeProbe />
        </ThemeProvider>
      </NavigationThemeProvider>,
    );
    expect(screen.getByTestId('navigation-theme').props.children).toBe(
      [mode === 'dark', Colors[mode].card, Colors[mode].foreground].join('|'),
    );
    expect(StyleSheet.flatten(screen.getByTestId('themed-surface').props.style).backgroundColor).toBe(
      Colors[mode].background,
    );
    await screen.unmount();
  });
});
