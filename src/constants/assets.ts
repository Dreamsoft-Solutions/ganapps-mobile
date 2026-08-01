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
  /** Default placeholder avatar. */
  defaultAvatar: require('../../assets/images/default-avatar.jpg'),
} as const;
