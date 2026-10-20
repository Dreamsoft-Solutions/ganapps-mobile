/**
 * Keeps Firebase Analytics out of the iOS and Android builds (DS-92, ADR 0006).
 * `@react-native-firebase/remote-config` lists it as a peer dependency, so npm installs it and
 * Expo autolinks it, but nothing in the app calls it and it would otherwise ship Google
 * Analytics, its IDFA code and Android's AD_ID permission.
 */
module.exports = {
  dependencies: {
    '@react-native-firebase/analytics': {
      platforms: {
        ios: null,
        android: null,
      },
    },
  },
};
