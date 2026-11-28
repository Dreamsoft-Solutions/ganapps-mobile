import { create } from 'zustand';

/** The tab bar dock's measured state, shared so screens can clear what floats above the island. */
export interface TabBarState {
  /** Height in dp of what floats above the island inside the dock (the connection banner and its gap), 0 when nothing does. */
  aboveIslandHeight: number;
  /** Records the height above the island, ignoring repeats so a re-layout does not re-render every tab screen. */
  setAboveIslandHeight: (height: number) => void;
}

export const useTabBarStore = create<TabBarState>((set, get) => ({
  aboveIslandHeight: 0,

  setAboveIslandHeight: (height: number): void => {
    if (get().aboveIslandHeight !== height) set({ aboveIslandHeight: height });
  },
}));
