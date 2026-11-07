import { create } from 'zustand';
import type { User } from '@/types/user.types';
import { secureStorage } from '@/utils/secure-storage';

interface AuthState {
  token: string | null;
  expiresAt: number | null;
  user: User | null;
  isHydrated: boolean;
  sessionVersion: number;

  setAuth: (
    accessToken: string,
    refreshToken: string,
    expiresIn: number,
    expectedSessionVersion?: number,
  ) => Promise<void>;
  setUser: (user: User) => void;
  clearAuth: () => Promise<void>;
  hydrate: () => Promise<void>;
}

let authRevision = 0;
let persistenceQueue: Promise<void> = Promise.resolve();

function serializePersistence(operation: () => Promise<void>): Promise<void> {
  const result = persistenceQueue.then(operation);
  persistenceQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

/** In-memory session state with explicit encrypted token persistence. */
export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  expiresAt: null,
  user: null,
  isHydrated: false,
  sessionVersion: 0,

  setAuth: async (
    accessToken: string,
    refreshToken: string,
    expiresIn: number,
    expectedSessionVersion?: number,
  ): Promise<void> => {
    if (expectedSessionVersion !== undefined && get().sessionVersion !== expectedSessionVersion) {
      throw new Error('Authenticated session changed before token persistence');
    }
    const previousVersion = get().sessionVersion;
    const revision = ++authRevision;
    set({ sessionVersion: revision });
    try {
      await serializePersistence(async () => {
        if (revision !== authRevision) throw new Error('Authenticated session changed before token persistence');
        await secureStorage.setTokens(accessToken, refreshToken, expiresIn);
        if (revision !== authRevision) throw new Error('Authenticated session changed during token persistence');
        set({ token: accessToken, expiresAt: Date.now() + expiresIn * 1000, sessionVersion: revision });
      });
    } catch (error) {
      if (revision === authRevision) set({ sessionVersion: previousVersion });
      throw error;
    }
  },

  setUser: (user: User): void => {
    if (get().user?.id === user.id) {
      set({ user });
      return;
    }
    const revision = ++authRevision;
    set({ user, sessionVersion: revision });
  },

  /**
   * Disables authenticated queries immediately and removes all persisted tokens.
   * @returns Completion of secure token removal.
   * @throws When the encrypted storage cannot remove a token.
   */
  clearAuth: async (): Promise<void> => {
    const revision = ++authRevision;
    set({ token: null, expiresAt: null, user: null, sessionVersion: revision });
    await serializePersistence(async () => {
      if (revision === authRevision) await secureStorage.clearTokens();
    });
  },

  hydrate: async (): Promise<void> => {
    if (get().isHydrated) return;
    const revision = authRevision;
    try {
      const token = await secureStorage.getAccessToken();
      const expiresAt = await secureStorage.getExpiresAt();
      if (revision === authRevision) set({ token, expiresAt, isHydrated: true });
      else set({ isHydrated: true });
    } catch {
      if (revision === authRevision) set({ token: null, expiresAt: null, isHydrated: true });
      else set({ isHydrated: true });
    }
  },
}));
