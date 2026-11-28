import { cubicBezier, Easing } from 'react-native-reanimated';

import { Assets } from '@/constants/assets';

/** One Welcome slide: a full-screen photo and the copy shown over it. */
export interface OnboardingSlide {
  readonly key: string;
  /** Metro asset id of the 1080x2400 stage photo. */
  readonly image: number;
  /** The headline shown while this slide is active. */
  readonly caption: string;
  /** The supporting line under the headline. */
  readonly body: string;
  /** Screen-reader description of the photo. */
  readonly imageLabel: string;
}

/**
 * The Welcome slides in swipe order. One slide ships for now; the pager, the headline cross-fade
 * and the page dots already handle more, so adding a slide is one entry here and one photo in
 * `Assets.onboarding`.
 *
 * @example
 * ONBOARDING_SLIDES.map((slide) => <Image key={slide.key} source={slide.image} />);
 */
export const ONBOARDING_SLIDES: readonly OnboardingSlide[] = [
  {
    key: 'together',
    image: Assets.onboarding[0],
    caption: 'Find what is happening across Iloilo.',
    body: 'Make the plan with your people and keep every event detail close.',
    imageLabel: 'Two friends look at a phone together',
  },
];

/** Wordmark shown as the display title. */
export const BRAND_NAME: string = 'Ganapps';

/** Line shown under the wordmark on the splash. */
export const BRAND_TAGLINE: string = 'Made for Iloilo. Built for everyone.';

/** Visible diameter of the round mark in the Welcome header, dp. */
export const HEADER_LOGO_SIZE: number = 72;

/**
 * Visible diameter of the round mark in the splash composition, dp. The native splash draws the
 * round PNG 200dp wide and its disc is 726/1080 of that, so this must stay 200 * 726 / 1080.
 */
export const SPLASH_LOGO_SIZE: number = (200 * 726) / 1080;

/** Top-right lobe placement, dp. */
interface TopRightLobe {
  readonly size: number;
  readonly top: number;
  readonly right: number;
}

/** Bottom-left lobe placement, dp. */
interface BottomLeftLobe {
  readonly size: number;
  readonly bottom: number;
  readonly left: number;
  readonly opacity: number;
}

/**
 * Placement of the two background lobes, shared by the splash and Welcome so their first frames match.
 *
 * @example
 * ONBOARDING_LOBES.map((lobe) => <Lobe key={lobe.size} {...lobe} />);
 */
export const ONBOARDING_LOBES: readonly [TopRightLobe, BottomLeftLobe] = [
  { size: 460, top: -230, right: -210 },
  { size: 440, bottom: -170, left: -230, opacity: 0.85 },
];

/** Strong ease-out for anything entering, callable inside a worklet: `Easing.bezierFn(0.23, 1, 0.32, 1)`. */
export const EASE_OUT: (t: number) => number = Easing.bezierFn(0.23, 1, 0.32, 1);

/** Ease-in-out for things moving on screen, callable inside a worklet: `Easing.bezierFn(0.77, 0, 0.175, 1)`. */
export const EASE_IN_OUT: (t: number) => number = Easing.bezierFn(0.77, 0, 0.175, 1);

/** The same ease-out for Reanimated CSS transitions and animations: `cubicBezier(0.23, 1, 0.32, 1)`. */
export const CSS_EASE_OUT: ReturnType<typeof cubicBezier> = cubicBezier(0.23, 1, 0.32, 1);
