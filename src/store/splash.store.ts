import { create } from 'zustand';

/** The splash store's state and its one action. */
export interface SplashState {
  /** True while the Welcome screen is mounted and has drawn its first frame. */
  welcomeShown: boolean;
  /** Called by the Welcome screen when it has drawn, and again with `false` when it unmounts. */
  setWelcomeShown: (shown: boolean) => void;
}

/**
 * Hand-off between the root splash and the Welcome screen. The root layout keeps the splash over
 * the stack until Welcome reports that it has drawn, so a signed-out launch never shows an empty
 * frame between the two. Client-only state; nothing is persisted.
 *
 * @example
 * const welcomeShown = useSplashStore((state) => state.welcomeShown);
 */
export const useSplashStore = create<SplashState>((set) => ({
  welcomeShown: false,
  setWelcomeShown: (shown: boolean): void => {
    set({ welcomeShown: shown });
  },
}));
