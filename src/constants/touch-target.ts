/**
 * The minimum interactive target this app ships, in dp on Android and pt on iOS.
 *
 * Apple's Human Interface Guidelines ask for 44, the Android guidelines for 48.
 * ADR 0005 resolves the difference by clearing the stricter of the two rather
 * than branching on `Platform.OS`, so one number covers both stores.
 */
export const MIN_TOUCH_TARGET: number = 48;

/**
 * The geometry of a control's touch target: what it draws, and what it accepts.
 *
 * A control satisfies {@link MIN_TOUCH_TARGET} either by rendering at that size
 * or by rendering smaller and extending its reach with `hitSlop`.
 */
export interface TouchTarget {
  /** The control's rendered edge length, in px. */
  readonly sizePx: number;
  /** Extra pressable margin on every edge, in px. `0` when the control needs none. */
  readonly hitSlop: number;
}

/**
 * The edge length a control actually accepts a press across.
 *
 * @param target - The control's rendered size and hit slop.
 * @returns The rendered size plus slop on both edges, in px.
 */
export function effectiveTargetPx(target: TouchTarget): number {
  return target.sizePx + target.hitSlop * 2;
}
