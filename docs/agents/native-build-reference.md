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

**No secret Mapbox token should be needed to build.** Earlier revisions of this file (and
DS-88, DS-101) required a `DOWNLOADS:READ` token in `~/.netrc` for `pod install`. As of
2026-09-23, Mapbox serves the iOS SDK archives (`MapboxCoreMaps` 11.23.1, `MapboxCommon`
24.23.1) and the Android Maven artifacts without authentication, and `rnmapbox-maps.podspec`
itself marks the download token as deprecated. That is checked against the download URLs, not
yet against an EAS cloud build — DS-101 stays open until the first one confirms it. A leftover
`machine api.mapbox.com` entry in `~/.netrc` is harmless.

The only Mapbox credential the app uses is `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`, the public `pk.`
runtime token. Never give a secret `sk.` token the `EXPO_PUBLIC_` prefix — that bundles it into
the shipped binary.

`npx expo prebuild -p ios --no-install` skips CocoaPods, which is enough to regenerate and
inspect `ios/Ganapps/Info.plist`.

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

### EAS cloud builds for iOS

`eas.json` has two store-signed iOS profiles. Both auto-increment the build number from the
same remote counter and pin the Xcode 26.6 image:

| Profile | EAS environment | API and Remote Config | Use |
|---|---|---|---|
| `testflight` | `preview` | dev API, `mobile_dev` | Internal TestFlight — `eas build -p ios --profile testflight --auto-submit` |
| `production` | `production` | production API, `mobile_prod` | App Store release |

A `testflight` build is never the one submitted for App Review — it talks to the dev API.

`eas.json` requires **eas-cli 24.4.2 or newer** (`cli.version`). Older versions fail the Apple
sign-in step with "Authentication with Apple Developer Portal failed! iTunes service key is
empty", after Apple changed its login flow in September 2026 (expo/eas-cli#4392, #4394). Upgrade
with `npm install -g eas-cli`.

The EAS environment a profile reads must hold everything the local `.env` and gitignored files
provide, because neither reaches the build worker:

- **`GOOGLE_SERVICE_INFO_PLIST`** — a *file* variable holding `GoogleService-Info.plist`.
  Without it `app.config.js` falls back to `./GoogleService-Info.plist`, which is gitignored
  and never uploaded, and the React Native Firebase plugin fails prebuild with
  "GoogleService-Info.plist doesn't exist". Android preview builds never needed it, so the
  `preview` environment may not have it yet (DS-86).
- Every `EXPO_PUBLIC_*` variable in `.env.example`, with `EXPO_PUBLIC_API_URL` set to the API
  that profile targets.

`testflight`'s Android block builds an internal APK without bumping the version code, so
forgetting `-p ios` cannot produce a dev-API Play Store bundle.

### iOS purpose strings

Every `NS*UsageDescription` in the generated Info.plist is app-written. `app.config.js` sets
them through each plugin's options instead of accepting the plugin defaults, which are generic
("Allow $(PRODUCT_NAME) to…") and a Guideline 5.1.1 risk. Run
`npx expo config --type introspect` to see the resolved set.

**`NSMotionUsageDescription` must stay, even though Ganapps never uses motion data.**
`expo-location` compiles `CMMotionActivityManager` code into every build, and it has no iOS
flag to leave it out. Apple scans the compiled binary and rejects the upload during processing
with **ITMS-90683** if the key is missing — "while your app might not use these APIs, a
purpose string is still required". That is what happened to build 3 on 2026-09-25, after
`motionUsagePermission: false` had removed the key (DS-144). The app never requests motion
access, so iOS never shows this string, and the App Privacy labels (DS-83) must not declare
Motion & Fitness data. A test in `app.config.test.ts` fails if the string is removed.

`microphonePermission: false` on `expo-camera` and `expo-image-picker` stays. expo-camera
contains audio-capture code, but Apple's ITMS-90683 check on build 3 listed only the motion key.
Re-check the processing email after upgrading either library.

**`NSPhotoLibraryUsageDescription` is written by two plugins**: `expo-image-picker` and
`expo-media-library`. Whichever runs last wins, and `photosPermission: false` on either one
deletes the key outright. For a while `expo-media-library` had `false`, which silently removed the
image picker's string from the resolved Info.plist. Both plugins must carry the same app-written
`photosPermission`, and a test in `app.config.test.ts` enforces it. Saving the QR image uses the
separate `NSPhotoLibraryAddUsageDescription` (`savePhotosPermission`).

---
