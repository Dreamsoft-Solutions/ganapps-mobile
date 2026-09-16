import { create } from 'zustand';
import type { User } from '@/types/user.types';
import { secureStorage } from '@/utils/secure-storage';

interface AuthState {
  token: string | null;
  expiresAt: number | null;
  user: User | null;
  isHydrated: boolean;

  setAuth: (accessToken: string, refreshToken: string, expiresIn: number) => Promise<void>;
  setUser: (user: User) => void;
  clearAuth: () => Promise<void>;
  hydrate: () => Promise<void>;
}

/** In-memory session state with explicit encrypted token persistence. */
export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  expiresAt: null,
  user: null,
  isHydrated: false,

  setAuth: async (accessToken: string, refreshToken: string, expiresIn: number): Promise<void> => {
    await secureStorage.setTokens(accessToken, refreshToken, expiresIn);
    set({
      token: accessToken,
      expiresAt: Date.now() + expiresIn * 1000,
    });
  },

  setUser: (user: User): void => set({ user }),

  /**
   * Disables authenticated queries immediately and removes all persisted tokens.
   * @returns Completion of secure token removal.
   * @throws When the encrypted storage cannot remove a token.
   */
  clearAuth: async (): Promise<void> => {
    set({ token: null, expiresAt: null, user: null });
    await secureStorage.clearTokens();
  },

  hydrate: async (): Promise<void> => {
    if (get().isHydrated) return;
    const token = await secureStorage.getAccessToken();
    const expiresAt = await secureStorage.getExpiresAt();
    set({ token, expiresAt, isHydrated: true });
  },
}));
