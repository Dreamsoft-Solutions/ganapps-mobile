# ADR 0006: Firebase Analytics Is Installed but Not Linked

**Date:** 2026-10-11
**Status:** Accepted

## Context

`@react-native-firebase/remote-config` lists `@react-native-firebase/analytics` as a peer
dependency, a 2021 addition (v10.6.0, issue #4821) that the app never asked for, so npm installs it
without it appearing in `package.json`. Since SDK 54, Expo autolinks React Native modules that
arrive only as transitive dependencies. Together these put Firebase Analytics into every build:

- iOS linked `RNFBAnalytics`, `FirebaseAnalytics`, `GoogleAppMeasurement` and
  `GoogleAppMeasurementIdentitySupport`, the IDFA-capable code. The 12.15.0 Analytics pods ship
  no privacy manifest.
- Android merged `com.google.android.gms.permission.AD_ID`, `ACCESS_ADSERVICES_AD_ID` and
  `ACCESS_ADSERVICES_ATTRIBUTION` through `play-services-measurement-api`.
- Analytics collects lifecycle events and IP-derived coarse location with no app code, and with no
  `firebase.json` its collection, ad ID and SSAID defaults are all on.

Nothing in `src/` calls Analytics. React Native Firebase's 10.6.0 changelog says "remote-config
requires analytics", but that commit (`06c2a18`) changed only a docs page and the peer
dependency, citing Firebase's integration guides. The Remote Config SDKs treat Analytics as
optional: Android's `RemoteConfigRegistrar` declares `AnalyticsConnector` with
`Dependency.optionalProvider`, and iOS fetches `FIRAnalyticsInterop` as nullable. Firebase needs
Analytics only for Remote Config targeting on audiences, user properties or first open time, and
for personalizations and A/B Testing experiments. The `ganapps` project has no Remote Config
conditions (checked in the Firebase console, 2026-10-11). Shipping it anyway meant
the App Store privacy labels, the privacy manifest and the Play Data safety and Advertising ID
answers would all have to declare data the app has no use for (DS-92).

## Decision

Analytics stays installed but is not linked. `react-native.config.js` at the repo root sets the
`ios` and `android` platforms of `@react-native-firebase/analytics` to `null`, which Expo's
autolinking resolver treats as "skip this package". `forceStaticLinking` (ADR 0002) lists only the
Firebase pods that still link: `RNFBApp`, `RNFBAuth` and `RNFBRemoteConfig`.

`app.config.test.ts` runs the same `expo-modules-autolinking react-native-config` command the
Podfile and `settings.gradle` run, and fails if Analytics links on either platform, if Remote
Config stops linking, or if `forceStaticLinking` drifts from the linked Firebase pods.

## Alternatives Considered

1. **Keep it linked and switch collection off in `firebase.json`.** Rejected because the code and
   Android's `AD_ID` permission would still ship. Play reads the manifest, so the Advertising ID
   answer would still have to account for it, and the labels would rest on a runtime flag rather
   than on what the binary contains.
2. **Keep it and declare it.** Rejected because it declares identifiers, usage data and location
   that nobody reads.
3. **`expo.autolinking.legacy_shallowReactNativeLinking`.** Rejected because it unlinks every
   transitive native module, not just this one.
4. **`expo.autolinking.exclude` in `package.json`.** Also unlinks it, verified with the CLI's
   `--exclude` flag, and is the more robust of the two. `exclude` drops the package before Expo
   reads its config. A `null` platform is instead merged over the package's own config, and
   `expo-modules-autolinking` 57.0.3 ignores the `null` when the package ships a
   `react-native.config.js` that defines that platform. `react-native.config.js` was chosen
   because it is the route Expo documents for React Native modules, states each platform
   explicitly and needs no `package.json` change, and because the analytics package ships no
   config of its own.

## Consequences

- Neither binary contains Google Analytics, its IDFA code or the `AD_ID` permission. The privacy
  manifest, App Privacy labels and Play Data safety form declare nothing for Firebase Analytics
  (DS-83, DS-93, DS-134).
- `npm ls` still lists `@react-native-firebase/analytics`. That is expected: installed is not
  linked.
- Remote Config features that depend on Analytics will not work: conditions on audiences, user
  properties or first open time, personalizations, and A/B Testing experiments. Adding any of
  them, even from the Firebase console alone, means revisiting this ADR first.
- Adding Analytics on purpose means removing the `react-native.config.js` entry, adding
  `RNFBAnalytics` back to `forceStaticLinking`, and updating every privacy disclosure before the
  build ships.
- The `null` override holds only while `@react-native-firebase/analytics` ships no
  `react-native.config.js` of its own. If a React Native Firebase release adds one, or an Expo
  release changes how `null` platforms resolve, Analytics links again and `npm run test` fails
  rather than shipping silently. The fallback is `expo.autolinking.exclude` (Alternative 4).
- The test reads only Expo's autolinking output, so it can't see Analytics arriving as a podspec
  or Gradle dependency of another Firebase module. Re-check this ADR whenever a React Native
  Firebase version changes in `package-lock.json`; `package.json` uses caret ranges, so a lockfile
  refresh can move it without a deliberate upgrade.
