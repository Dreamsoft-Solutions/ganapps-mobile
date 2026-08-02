import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { renderHook } from '@testing-library/react-native';
import { useColorScheme } from 'react-native';
import { useThemeStore } from '@/store/theme.store';
import { useResolvedTheme } from './useResolvedTheme';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockedUseColorScheme = jest.mocked(useColorScheme);

describe('useResolvedTheme', (): void => {
  afterEach((): void => {
    useThemeStore.setState({ mode: 'light' });
  });

  it('returns the explicit preference even when the device disagrees', async (): Promise<void> => {
    mockedUseColorScheme.mockReturnValue('dark');
    useThemeStore.setState({ mode: 'light' });

    const { result, unmount } = await renderHook(() => useResolvedTheme());

    expect(result.current).toBe('light');
    unmount();
  });

  it('returns dark when explicitly set while the device is light', async (): Promise<void> => {
    mockedUseColorScheme.mockReturnValue('light');
    useThemeStore.setState({ mode: 'dark' });

    const { result, unmount } = await renderHook(() => useResolvedTheme());

    expect(result.current).toBe('dark');
    unmount();
  });

  it('follows the device scheme when the preference is system', async (): Promise<void> => {
    mockedUseColorScheme.mockReturnValue('dark');
    useThemeStore.setState({ mode: 'system' });

    const { result, unmount } = await renderHook(() => useResolvedTheme());

    expect(result.current).toBe('dark');
    unmount();
  });

  it('falls back to light when the device scheme is unspecified', async (): Promise<void> => {
    mockedUseColorScheme.mockReturnValue('unspecified');
    useThemeStore.setState({ mode: 'system' });

    const { result, unmount } = await renderHook(() => useResolvedTheme());

    expect(result.current).toBe('light');
    unmount();
  });
});
