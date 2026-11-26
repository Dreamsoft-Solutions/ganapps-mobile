/**
 * Local image assets resolved at build time by Metro.
 *
 * Every `require()` path is relative to this file (`src/constants/`), so paths go up
 * two levels to the project root then into `assets/`.
 */
export const Assets = {
  /** Logo with "Ganapps" wordmark — green text for light backgrounds. */
  logoLightText: require('../../assets/brand/ganap-logo-green-text.png'),
  /** Logo with "Ganapps" wordmark — white text for dark backgrounds. */
  logoDarkText: require('../../assets/brand/ganap-logo-white-text.png'),
  /** Icon-only logo (no text). */
  logoIcon: require('../../assets/brand/ganap-logo-1.png'),
  /** Round logo mark on its navy disc. The disc is 726 of the 1080px canvas; the rest is transparent. */
  logoRound: require('../../assets/brand/ganap-logo-round.png'),
  /**
   * Welcome stage cut-outs in slide order. Each file is a 1080x1280 transparent canvas with the
   * subject bottom-aligned. Replace a file in `assets/images/onboarding/` to swap a slide.
   */
  onboarding: [
    require('../../assets/images/onboarding/onboarding-1.webp'),
    require('../../assets/images/onboarding/onboarding-2.webp'),
    require('../../assets/images/onboarding/onboarding-3.webp'),
  ],
  /** Default placeholder avatar. */
  defaultAvatar: require('../../assets/images/default-avatar.jpg'),
} as const;
