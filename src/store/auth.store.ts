import { create } from 'zustand';
import type { User } from '@/types/user.types';
import { secureStorage } from '@/utils/secure-storage';
import { storage } from '@/utils/storage';

interface AuthState {
  token: string | null;
  expiresAt: number | null;
  user: User | null;
  isHydrated: boolean;
  hasCompletedOnboarding: boolean;

  setAuth: (accessToken: string, refreshToken: string, expiresIn: number) => Promise<void>;
  setUser: (user: User) => void;
  clearAuth: () => Promise<void>;
  hydrate: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  expiresAt: null,
  user: null,
  isHydrated: false,
  hasCompletedOnboarding: false,

  setAuth: async (accessToken, refreshToken, expiresIn) => {
    await secureStorage.setTokens(accessToken, refreshToken, expiresIn);
    set({
      token: accessToken,
      expiresAt: Date.now() + expiresIn * 1000,
    });
  },

  setUser: (user) => set({ user }),

  clearAuth: async () => {
    await secureStorage.clearTokens();
    await storage.remove('hasCompletedOnboarding');
    set({ token: null, expiresAt: null, user: null, hasCompletedOnboarding: false });
  },

  hydrate: async () => {
    if (get().isHydrated) return;
    const token = await secureStorage.getAccessToken();
    const expiresAt = await secureStorage.getExpiresAt();
    const hasCompletedOnboarding = await storage.get<boolean>('hasCompletedOnboarding');
    set({ token, expiresAt, hasCompletedOnboarding: !!hasCompletedOnboarding, isHydrated: true });
  },

  completeOnboarding: async () => {
    await storage.set('hasCompletedOnboarding', true);
    set({ hasCompletedOnboarding: true });
  },
}));
