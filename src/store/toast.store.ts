import { create } from 'zustand';

/** Visual tone of a toast; drives its icon and icon colour. */
export type ToastType = 'error' | 'success' | 'info';

/** A single toast rendered by `ToastHost`. */
export interface ToastItem {
  /** Unique id used for dismissal and React keys. */
  id: string;
  /** Tone of the toast. */
  type: ToastType;
  /** Primary line, in semibold. */
  title: string;
  /** Optional secondary line under the title. */
  message?: string;
}

interface ToastState {
  /** Active toasts, newest last. */
  toasts: ToastItem[];
  /**
   * Shows a toast and schedules its auto-dismissal. Identical toasts already on
   * screen are deduplicated — the existing id is returned instead.
   */
  show: (type: ToastType, title: string, message?: string) => string;
  /** Removes a toast immediately and cancels its auto-dismissal timer. */
  dismiss: (id: string) => void;
}

/** How long a toast stays on screen before auto-dismissing. */
export const TOAST_DURATION_MS = 4000;

/** Maximum toasts kept on screen; older ones are evicted when exceeded. */
export const MAX_TOASTS = 3;

const dismissTimers = new Map<string, ReturnType<typeof setTimeout>>();

let idCounter = 0;

function nextId(): string {
  idCounter += 1;
  return `toast-${Date.now()}-${idCounter}`;
}

function clearDismissTimer(id: string): void {
  const timer = dismissTimers.get(id);
  if (timer) clearTimeout(timer);
  dismissTimers.delete(id);
}

/**
 * Client-side toast queue. Timers live in a module-level map rather than in
 * state so auto-dismissal can be exercised outside React (e.g. by the query
 * cache error handlers in `RootProvider`).
 */
export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  show: (type: ToastType, title: string, message?: string): string => {
    const existing = get().toasts.find(
      (toast: ToastItem): boolean => toast.type === type && toast.title === title && toast.message === message,
    );
    if (existing) return existing.id;

    const id = nextId();
    const item: ToastItem = { id, type, title, message };

    const { toasts } = get();
    if (toasts.length >= MAX_TOASTS) {
      clearDismissTimer(toasts[0].id);
    }
    set({ toasts: [...toasts, item].slice(-MAX_TOASTS) });

    dismissTimers.set(
      id,
      setTimeout((): void => dismissToast(id), TOAST_DURATION_MS),
    );
    return id;
  },

  dismiss: (id: string): void => {
    clearDismissTimer(id);
    set(
      (state: ToastState): Partial<ToastState> => ({
        toasts: state.toasts.filter((toast: ToastItem): boolean => toast.id !== id),
      }),
    );
  },
}));

/**
 * Shows a toast. Callable from outside React via the store's `getState`.
 *
 * @param type - Tone of the toast.
 * @param title - Primary line.
 * @param message - Optional secondary line.
 * @returns The toast's id, or the id of a deduplicated existing toast.
 */
export function showToast(type: ToastType, title: string, message?: string): string {
  return useToastStore.getState().show(type, title, message);
}

/**
 * Dismisses a toast by id, cancelling its auto-dismissal timer.
 *
 * @param id - The toast id returned by `showToast`.
 */
export function dismissToast(id: string): void {
  useToastStore.getState().dismiss(id);
}
