/**
 * Keeps Firebase Analytics out of the iOS and Android builds (DS-92, ADR 0006).
 * `@react-native-firebase/remote-config` lists it as a peer dependency, so npm installs it and
 * Expo autolinks it, but nothing in the app calls it and it would otherwise ship Google
 * Analytics, its IDFA code and Android's AD_ID permission.
 *
 * Links `@react-native-firebase/messaging` on iOS only (DS-135, ADR 0008). iOS needs it to turn
 * the APNs registration into the FCM token the server sends to. On Android its
 * `com.google.firebase.MESSAGING_EVENT` service would outrank expo-notifications' service, which
 * declares priority -1, and take over every incoming push.
 */
module.exports = {
  dependencies: {
    '@react-native-firebase/analytics': {
      platforms: {
        ios: null,
        android: null,
      },
    },
    '@react-native-firebase/messaging': {
      platforms: {
        android: null,
      },
    },
  },
};
