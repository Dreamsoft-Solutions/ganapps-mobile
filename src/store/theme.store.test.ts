import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { storage } from '@/utils/storage';
import { type ThemeMode, useThemeStore } from './theme.store';

jest.mock('@/utils/storage', () => ({ storage: { get: jest.fn(), set: jest.fn() } }));

const getStoredMode = jest.mocked(storage.get);

describe('theme preference hydration', (): void => {
  beforeEach((): void => {
    useThemeStore.setState({ isHydrated: false });
    getStoredMode.mockReset();
  });

  it('uses the system scheme when no preference has been saved', async (): Promise<void> => {
    getStoredMode.mockResolvedValue(null);
    await useThemeStore.getState().hydrate();
    expect(useThemeStore.getState()).toMatchObject({ mode: 'system', isHydrated: true });
  });

  it.each<ThemeMode>([
    'light',
    'dark',
    'system',
  ])('preserves the saved %s preference', async (mode: ThemeMode): Promise<void> => {
    getStoredMode.mockResolvedValue(mode);
    await useThemeStore.getState().hydrate();
    expect(useThemeStore.getState()).toMatchObject({ mode, isHydrated: true });
  });
});
