import { useEffect, useState } from 'react';

/**
 * Defers a rapidly changing value until it has been stable for `delayMs`.
 *
 * Used to keep a fast-changing input (a search box) out of a TanStack query key,
 * so typing does not fire one request — and one re-render of anything reading the
 * result — per keystroke.
 *
 * @param value - The value to defer.
 * @param delayMs - Quiet period the value must hold before it is published.
 * @returns The most recent value that stayed unchanged for `delayMs`.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
