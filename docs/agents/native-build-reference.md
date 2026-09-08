# Mobile native build reference

Read the sections relevant to the task. Code paths and command working directories in this reference are relative to the repository root unless stated otherwise.

## Known Drift — do not imitate

Scaffolding from the template that survives in the tree. It compiles, so it looks real.

| Item | Reality |
|---|---|
| `api/endpoints/users.ts` | There is no `/users` controller. `getMe` and `updateProfile` live on `authAPI`. |
| `Empty`'s `icon?: string` prop | Renders a string at `text-4xl`, i.e. an emoji slot, which contradicts the no-emoji rule. Use `lucide-react-native` instead. |

There is **no `(auth)/register.tsx`**. Registration is a mode toggle inside
`components/forms/LoginForm.tsx`, which swaps between `loginSchema` and `registerSchema` and
between `useAuth`'s `login` and `register`. `constants/routes.ts` therefore has no
`auth.register` entry, and adding one would fail `npm run type-check`. Earlier revisions of
this file listed the screen; it never existed.

`npx expo prebuild` needs two artifacts that are not in the repo, both downloaded from the
Firebase console for the `com.ganapps.app` apps and placed in the project root:
**`google-services.json`** (Android) and **`GoogleService-Info.plist`** (iOS).
`app.config.js` points at them via `android.googleServicesFile` and `ios.googleServicesFile`.
Both are gitignored and hold project credentials, so each developer downloads their own
rather than sharing copies.

**Both Firebase apps are registered.** Verified 2026-08-29 by reading the plist:
`BUNDLE_ID: com.ganapps.app`, `PROJECT_ID: ganapps`, `IS_SIGNIN_ENABLED: true`. Earlier
revisions of this file said the iOS app was unregistered; that was wrong.

iOS prebuild needs a third thing: a secret Mapbox token with `DOWNLOADS:READ` scope in
`~/.netrc`, under `machine api.mapbox.com`. `@rnmapbox/maps` fetches the Mapbox iOS SDK from a
private registry at `pod install` time, so without it `pod install` fails and no iOS build is
possible. This is separate from `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` in `.env`, which is the
public `pk.` runtime token. Never put the secret token in `.env` — the `EXPO_PUBLIC_` prefix
bundles it into the shipped binary.

**This is configured and no longer a blocker** (DS-88, done). Earlier revisions of this file
said no iOS build was possible; that stopped being true on 2026-08-31. The token is per
developer and is never shared — each person generates their own in the Mapbox account page and
writes their own `~/.netrc`.

`npx expo prebuild -p ios --no-install` skips CocoaPods and works without the Mapbox token,
which is enough to regenerate and inspect `ios/ganappsmobile/Info.plist`.

`android.package` and `ios.bundleIdentifier` are both **`com.ganapps.app`**, matching the
Android app AJ registered in the production Firebase project (confirmed with him — it is not a
scratch project). `google-services.json` embeds this string,
so the two must stay identical character-for-character or Firebase fails at runtime with an
error that does not name the mismatch. Do not "correct" it to a `com.<company>.<app>` shape.

Changing it is cheap until the first Play Store or App Store upload — nothing is published yet,
`/android` and `/ios` are regenerated from `app.config.js` — and effectively impossible afterwards,
since the identifier is permanent on both stores and tied to the signing key.

A config-plugin entry in `app.config.js` must be a package that actually ships an `app.plugin.js`.
`@react-native-firebase/app` does; `@react-native-firebase/remote-config` does not, and listing
it made Expo load the package's runtime entry as a plugin, which threw and broke **all** config
resolution — `expo start`, `expo config`, `expo prebuild` and `expo customize` alike. Check for
`app.plugin.js` in the package root before adding a plugin here.

---

## iOS Native Build Configuration

The iOS build only links if `app.config.js` carries an `expo-build-properties` block with all
three of these settings. They were established on 2026-09-05 getting the first simulator build
to run, and each one fixes a failure that the previous one exposes — removing any of them
breaks the build again, in a way whose error message does not point back here.

```js
[
  'expo-build-properties',
  {
    ios: {
      useFrameworks: 'static',
      usePrecompiledModules: false,
      forceStaticLinking: ['RNFBApp', 'RNFBAuth', 'RNFBRemoteConfig', 'RNFBAnalytics'],
    },
  },
],
```

- **`useFrameworks: 'static'`** — React Native Firebase's Swift pods (`FirebaseAuth`,
  `FirebaseRemoteConfig`) depend on Objective-C pods that emit no module maps, so they cannot
  link as plain static *libraries* and `pod install` fails outright. Static *frameworks* do
  define modules. Static rather than dynamic because `@rnmapbox/maps` keeps every Mapbox pod
  static under Expo's precompiled-modules pipeline — `rnmapbox-maps.podspec` has an explicit
  branch keyed on `EXPO_USE_PRECOMPILED_MODULES` — and dynamic fights it. RNFirebase's own docs
  recommend dynamic, but that guidance assumes SPM mode, which this project is not in.
- **`usePrecompiledModules: false`** — Expo ships prebuilt XCFrameworks for its own modules and
  they are not built for static-framework linkage. Left on, the app compiles, installs, and
  then dies at launch under dyld with
  `Symbol not found: ExpoModulesCore.AnyModule._decorateObject`, because `ExpoCamera` resolved a
  different `ExpoModulesCore` than the one bundled. The cost is build time — nothing is
  prebuilt, so a full rebuild is slow. Incremental rebuilds still hit derived data.
- **`forceStaticLinking`** — React Native core stays prebuilt regardless
  (`usePrecompiledModules` covers only Expo's modules), and on RN 0.84+ / Expo 54+ with
  prebuilt core every RNFB native module must be listed here. Otherwise its headers fail
  `-Werror=non-modular-include-in-framework-module` on `#import <React/RCTBridgeModule.h>`.
  Keep this list in sync with the `RNFB*` pods in `ios/Podfile.lock`.

`@react-native-firebase/app` is pinned at 25.1.0, which has no SPM support and so no
`disableSPM` plugin option — the package contains no such string. RNFirebase's docs pair
`forceStaticLinking` with `disableSPM: true`; on this version that half of the recipe does not
apply and setting it does nothing. Revisit when the package is upgraded.

Xcode also needs the full iOS platform for its own version installed (Settings → Components),
not merely a simulator runtime. Without it `xcodebuild -showdestinations` lists no simulator
destination at all and `expo run:ios` fails with `Unable to find a destination matching the
provided destination specifier`, which reads like a device-selection bug rather than a missing
multi-GB download. None of this needs an Apple Developer Program membership — the simulator
signs locally; the membership matters only for TestFlight and App Store submission.

---
