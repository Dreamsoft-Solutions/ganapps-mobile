import { create } from 'zustand';
import type { User } from '@/types/user.types';
import { secureStorage } from '@/utils/secure-storage';

interface AuthSession {
  token: string | null;
  expiresAt: number | null;
  user: User | null;
  isHydrated: boolean;
  accountSessionId: number;
  sessionVersion: number;
}

type AuthOptions = { user: User } | { expectedSessionVersion: number };

interface AuthState extends AuthSession {
  getStableSession: () => Promise<AuthSession>;
  /** Starts a sign-in session or rotates its credentials when a refresh supplies a version. */
  setAuth: (accessToken: string, refreshToken: string, expiresIn: number, options?: AuthOptions) => Promise<void>;
  /** Associates an authenticated profile with the session that requested it. */
  setUser: (user: User, accountSessionId: number) => void;
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

async function getStableSession(): Promise<AuthSession> {
  while (true) {
    const pending = persistenceQueue;
    await pending;
    if (pending !== persistenceQueue) continue;
    const { token, expiresAt, user, isHydrated, accountSessionId, sessionVersion } = useAuthStore.getState();
    return { token, expiresAt, user, isHydrated, accountSessionId, sessionVersion };
  }
}

/** In-memory session state with explicit encrypted token persistence. */
export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  expiresAt: null,
  user: null,
  isHydrated: false,
  accountSessionId: 0,
  sessionVersion: 0,
  getStableSession,

  setAuth: async (
    accessToken: string,
    refreshToken: string,
    expiresIn: number,
    options?: AuthOptions,
  ): Promise<void> => {
    const expectedSessionVersion =
      options && 'expectedSessionVersion' in options ? options.expectedSessionVersion : undefined;
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
        set({
          token: accessToken,
          expiresAt: Date.now() + expiresIn * 1000,
          sessionVersion: revision,
          ...(expectedSessionVersion === undefined
            ? { accountSessionId: revision, user: options && 'user' in options ? options.user : null }
            : {}),
        });
      });
    } catch (error) {
      if (revision === authRevision) set({ sessionVersion: previousVersion });
      throw error;
    }
  },

  setUser: (user: User, accountSessionId: number): void => {
    const current = get();
    if (
      !current.token ||
      current.accountSessionId !== accountSessionId ||
      (current.user && current.user.id !== user.id)
    ) {
      throw new Error('Authenticated session changed before the profile could be saved');
    }
    set({ user });
  },

  /**
   * Disables authenticated queries immediately and removes all persisted tokens.
   * @returns Completion of secure token removal.
   * @throws When the encrypted storage cannot remove a token.
   */
  clearAuth: async (): Promise<void> => {
    const revision = ++authRevision;
    set({ token: null, expiresAt: null, user: null, accountSessionId: revision, sessionVersion: revision });
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
