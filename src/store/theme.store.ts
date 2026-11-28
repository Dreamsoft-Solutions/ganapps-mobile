import { create } from 'zustand';
import { storage } from '@/utils/storage';

/**
 * User-facing theme preference.
 *
 * `'system'` follows the device OS color scheme; `'light'` and `'dark'` are explicit
 * overrides. The app defaults to `'system'` when no preference is stored.
 */
export type ThemeMode = 'light' | 'dark' | 'system';

const THEME_MODE_KEY = 'app_theme_mode';
const PERFORMANCE_MODE_KEY = 'app_performance_mode';

interface ThemeState {
  /** Persisted user preference; defaults to `'system'` for first-time users. */
  mode: ThemeMode;
  /**
   * Draws every glass pane with the flat Solid recipe instead of live glass over the map, which saves
   * battery and frames on older phones. Off by default.
   */
  performanceMode: boolean;
  /** `true` once {@link hydrate} has read the stored preference. */
  isHydrated: boolean;
  /** Persists the preference and applies it. */
  setMode: (mode: ThemeMode) => Promise<void>;
  /** Persists the Performance mode choice and applies it. */
  setPerformanceMode: (enabled: boolean) => Promise<void>;
  /** Reads the stored preferences from AsyncStorage. */
  hydrate: () => Promise<void>;
}

/**
 * Appearance preferences: the theme mode and Performance mode, persisted and hydrated before the app renders.
 *
 * @example
 * const performanceMode = useThemeStore((state) => state.performanceMode);
 */
export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'system',
  performanceMode: false,
  isHydrated: false,

  setMode: async (mode: ThemeMode): Promise<void> => {
    await storage.set(THEME_MODE_KEY, mode);
    set({ mode });
  },

  setPerformanceMode: async (enabled: boolean): Promise<void> => {
    await storage.set(PERFORMANCE_MODE_KEY, enabled);
    set({ performanceMode: enabled });
  },

  hydrate: async (): Promise<void> => {
    if (get().isHydrated) return;
    const [storedMode, storedPerformanceMode] = await Promise.all([
      storage.get<ThemeMode>(THEME_MODE_KEY),
      storage.get<boolean>(PERFORMANCE_MODE_KEY),
    ]);
    set({ mode: storedMode ?? 'system', performanceMode: storedPerformanceMode === true, isHydrated: true });
  },
}));
