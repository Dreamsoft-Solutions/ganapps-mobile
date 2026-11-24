import type { WalkParams } from '@/types/walk.types';

/**
 * Query keys for Event Walk pages.
 *
 * The root is its own so a like or save can reach every walk cache without touching
 * `ganapQueryKeys.lists()`, and so nothing that invalidates Ganap lists restarts a walk.
 */
export const walkQueryKeys = {
  all: ['walk'] as const,
  /** One walk: a run number makes "Start a new walk" a new cache entry for the same position and seeds. */
  run: (run: number, params: WalkParams) => [...walkQueryKeys.all, 'run', run, params] as const,
};
