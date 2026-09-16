import { create } from 'zustand';
import { storage } from '@/utils/storage';

/**
 * User-facing theme preference.
 *
 * `'system'` follows the device OS color scheme; `'light'` and `'dark'` are explicit
 * overrides. The app defaults to `'light'` when no preference is stored.
 */
export type ThemeMode = 'light' | 'dark' | 'system';

const THEME_MODE_KEY = 'app_theme_mode';

interface ThemeState {
  /** Persisted user preference; defaults to `'light'` for first-time users. */
  mode: ThemeMode;
  /** `true` once {@link hydrate} has read the stored preference. */
  isHydrated: boolean;
  /** Persists the preference and applies it. */
  setMode: (mode: ThemeMode) => Promise<void>;
  /** Reads the stored preference from AsyncStorage. */
  hydrate: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'light',
  isHydrated: false,

  setMode: async (mode: ThemeMode): Promise<void> => {
    await storage.set(THEME_MODE_KEY, mode);
    set({ mode });
  },

  hydrate: async (): Promise<void> => {
    if (get().isHydrated) return;
    const storedMode = await storage.get<ThemeMode>(THEME_MODE_KEY);
    set({ mode: storedMode ?? 'light', isHydrated: true });
  },
}));
