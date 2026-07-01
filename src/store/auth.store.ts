import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '@/types/user.types';

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;

  setToken: (token: string, refreshToken?: string) => void;
  clearAuth: () => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      user: null,

      setToken: (token, refreshToken) =>
        set({
          token,
          refreshToken: refreshToken ?? null,
        }),

      clearAuth: () =>
        set({
          token: null,
          refreshToken: null,
          user: null,
        }),

      setUser: (user) => set({ user }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
      }),
    },
  ),
);
