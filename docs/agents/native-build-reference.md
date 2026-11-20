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

**Firebase Analytics is installed but deliberately not linked.** `@react-native-firebase/remote-config`
lists `@react-native-firebase/analytics` as a peer dependency, so npm installs it, and Expo autolinks
transitive native modules. Unexcluded, it shipped Google Analytics, IDFA-capable code and Android's
`AD_ID` permission while nothing in the app called it. `react-native.config.js` sets its `ios` and
`android` platforms to `null` (DS-92, [ADR 0006](../../../home/docs/adr/mobile/0006-exclude-firebase-analytics-autolinking.md)).
`npm ls` still lists it; that is expected.

**iOS privacy manifests are audited, not assumed.** [iOS privacy manifests](../ios-privacy-manifests.md)
lists the linked pods that ship no manifest, the Required Reason APIs each binary calls, and the
reasons `ios.privacyManifests` in `app.config.js` declares for them (DS-93). Re-check it after an
Expo SDK, React Native or React Native Firebase upgrade, or when adding a native module.

---

## iOS Native Build Configuration

The iOS build only links if `app.config.js` carries an `expo-build-properties` block with the
first three of these settings. They were established on 2026-09-05 getting the first simulator build
to run, and each one fixes a failure that the previous one exposes — removing any of them
breaks the build again, in a way whose error message does not point back here. The fourth,
`enableSceneSupport`, is not about linking; it lets a build made with Xcode 27 launch on iOS 27
(see below).

```js
[
  'expo-build-properties',
  {
    ios: {
      useFrameworks: 'static',
      usePrecompiledModules: false,
      forceStaticLinking: ['RNFBApp', 'RNFBAuth', 'RNFBMessaging', 'RNFBRemoteConfig'],
      enableSceneSupport: true,
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
  It must name exactly the `RNFB*` pods Expo autolinks. Check the Podfile's autolinking output
  when Firebase modules change; Pact does not check this list.
- **`enableSceneSupport: true`** — apps built with the iOS 27 SDK (Xcode 27) must use the UIKit
  scene lifecycle, or they do not launch on iOS 27 ([ADR 0009](../../../home/docs/adr/mobile/0009-xcode-27-scene-support-on-sdk-57.md)).
  On SDK 57 the setting needs `expo` 57.0.23 or newer; on an older patch, prebuild throws. It
  changes the generated `AppDelegate.swift`: the class conforms to `ExpoReactNativeFactoryProvider`,
  and the window and `factory.startReactNative(...)` leave `didFinishLaunchingWithOptions`.
  `Info.plist` gains a `UIApplicationSceneManifest` naming `EXExpoAppSceneDelegate`, which starts
  React Native and forwards URLs, universal links and other scene events back to the AppDelegate,
  so its `openURL` override (with React Native Firebase Auth's `firebaseauth` guard) still runs.
  The setting edits only Expo's standard SDK 57 AppDelegate and throws if it finds anything else.
  Remove it when upgrading to SDK 58, whose template has scenes built in.

React Native Firebase 25.1.0 inserts `FirebaseApp.configure()` just above
`factory.startReactNative(`, the line scene support deletes. It still lands because it writes from
a dangerous mod, and Expo runs dangerous mods before the AppDelegate mod: the call stays in
`didFinishLaunchingWithOptions`, inside the now otherwise empty `#if os(iOS) || os(tvOS)` block.
Checked on 2026-11-18 by running the config's iOS mods over Expo 57.0.33's template. After any
change to plugin order, React Native Firebase or Expo, confirm `FirebaseApp.configure()` is in the
prebuilt `ios/Ganapps/AppDelegate.swift`. Newer React Native Firebase versions also match
`return super.application(...)`, so they no longer depend on that order.

`@react-native-firebase/app` is pinned at 25.1.0, which has no SPM support and so no
`disableSPM` plugin option — the package contains no such string. RNFirebase's docs pair
`forceStaticLinking` with `disableSPM: true`; on this version that half of the recipe does not
apply and setting it does nothing. Revisit when the package is upgraded.

Xcode also needs the full iOS platform for its own version installed (Settings → Components),
not merely a simulator runtime. Without it `xcodebuild -showdestinations` lists no simulator
destination at all and `expo run:ios` fails with `Unable to find a destination matching the
provided destination specifier`, which reads like a device-selection bug rather than a missing
multi-GB download. A plain `xcodebuild` simulator build signs locally without a certificate, but
`npx expo run:ios` does not; see the next section.

### Running the app on a simulator

`npx expo run:ios` builds, installs and opens the app, and starts Metro. It needs an **Apple
Development certificate** in the Mac's keychain, even for a simulator. `@expo/cli`
(`simulatorCodeSigning.js`) requires development signing whenever the entitlements include Sign
in with Apple or Associated Domains, and DS-137 added Sign in with Apple. Without a certificate it
stops with "No code signing certificates are available to use". Create one in Xcode under Settings,
Accounts, your team, Manage Certificates, then **+** and Apple Development. On an individual Apple
account only the Account Holder can. Expo then picks the certificate, writes the team into the
generated project and lets Xcode handle provisioning (verified 2026-11-16 with `@expo/cli` 57.0.3
and Xcode 27.2). Check what the keychain has with `security find-identity -v -p codesigning`.

Three things to know on Xcode 27:

- **Boot the simulator first, then run `npx expo run:ios` with no `--device`.** `devicectl` now lists
  simulators alongside phones, and Expo then treats a simulator passed with `--device` as a physical
  device. The install fails with "The capability Install Application is not supported by this
  device".
- **Expo checks for the Simulator app through System Events.** After the install it runs an
  AppleScript (`ensureSimulatorAppRunning.js`), which needs macOS Automation permission for the
  terminal app. Without it, `run:ios` exits with an `osascript` error right after the install, and
  the Metro it started stops too. The permission is under System Settings, Privacy & Security,
  Automation.
- **The app opens through the Google Sign-In URL scheme.** With no `expo-dev-client` in the project,
  Expo opens the longest URL scheme the app registers. If the app does not come up right after the
  install, tap its icon.

Each simulator holds its own build. After a native change (a new native package, a plugin or native
setting in `app.config.js`, `firebase.json`, or an Expo SDK upgrade), re-run
`npx expo prebuild --clean -p ios` and rebuild. A stale build fails with "Cannot find native module".
To see how old the installed build is, run `xcrun simctl listapps booted` and find
`com.ganapps.app`; a build still named "ganapps-mobile" predates the rename.

If `expo run:ios` is blocked, `xcodebuild` skips Expo's signing check. Run it from `ios/` with the
simulator booted and Metro running:

```bash
xcodebuild -workspace Ganapps.xcworkspace -scheme Ganapps -configuration Debug \
  -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' \
  -derivedDataPath build/sim build
xcrun simctl install booted build/sim/Build/Products/Debug-iphonesimulator/Ganapps.app
xcrun simctl launch booted com.ganapps.app
```

### Pod deployment-target floor

Xcode 27.1 rejects any target whose iOS deployment target is below 15.0. After prebuild, 12
CocoaPods resource-bundle targets in `ios/Pods/Pods.xcodeproj` still declared 9.0 to 14.0
(measured 2026-11-10, from `PromisesObjC`, `PromisesSwift`, `SDWebImage`,
`react-native-view-shot`, `GTMSessionFetcher`, `AppAuth`, `GTMAppAuth`, `GoogleSignIn`,
`GoogleUtilities`, `RNSVG`, `AsyncStorage` and `MapboxMaps`), and the build stopped with 12
errors. Each bundle takes its minimum from its podspec. `react_native_post_install` does not
help: its `updateOSDeploymentTarget` raises only each pod's main target, and only to React
Native's 15.1 minimum. Until this was fixed, a local build needed
`IPHONEOS_DEPLOYMENT_TARGET=16.4` on the `xcodebuild` command line, which the Xcode GUI has no
way to pass.

`plugins/with-ios-pod-deployment-target-floor.js` fixes it. It adds a tagged block to the
Podfile's `post_install`, ahead of `react_native_post_install`, that raises every Pods project
build configuration below the app's iOS deployment target up to that target. The target is
read during `pod install` from the Podfile's `platform :ios` line. That line uses
`ios.deploymentTarget` from `Podfile.properties.json`, which `expo-build-properties` sets, or
the template default of 16.4. The plugin names no version, so raising the app's target raises
the floor with it.

EAS builds need the plugin too, since they moved from Xcode 26.6 to Xcode 27.2 (ADR 0009). It
also raises pod targets from 15.1 to 16.4. That costs nothing at runtime, since the app cannot run below 16.4.
To confirm the block after prebuild, look for `ganapps-pod-deployment-target-floor` in
`ios/Podfile`. `npx expo config --type introspect` does not show it because Expo cannot
introspect the Podfile mod. Revisit the plugin after a React Native upgrade: if
`updateOSDeploymentTarget` starts covering resource bundles at 15.0 or higher, the plugin is
redundant.

### Push notifications on iOS

The server sends through Firebase Cloud Messaging, so iOS registers an FCM token from
`@react-native-firebase/messaging` rather than the APNs token `expo-notifications` returns
([ADR 0008](../../../home/docs/adr/mobile/0008-ios-push-tokens-from-firebase-messaging.md), DS-135). Four pieces of
configuration hold it together:

- **iOS-only linking.** `react-native.config.js` sets the package's `android` platform to `null`.
  Linked on Android, its `MESSAGING_EVENT` service would outrank `expo-notifications`' and take over
  every Android push.
- **`RNFBMessaging` in `forceStaticLinking`**, like every other React Native Firebase pod (see
  above).
- **`firebase.json`** at the repository root sets `messaging_ios_foreground_presentation_options`
  to `banner`, `list` and `sound`. The package answers iOS's foreground callback before
  `expo-notifications` does, and without this key it answers "show nothing". Keep it in step with
  `handleNotification` in `src/services/push-notification.service.ts`. React Native Firebase's
  build phase copies the file into the built `Info.plist` as `firebase_json_raw`, so a change needs
  a native rebuild. Once the file exists, that build phase needs `python3` and fails with
  "python3 not found" without it; EAS images and Macs with the Xcode command-line tools have it.
- **The `aps-environment` entitlement** was already there before DS-135: the `expo-notifications`
  config plugin writes `development` when nothing else sets it, which is the setup Expo's push docs
  recommend, and distribution signing takes the production value from the provisioning profile.
  The ticket's step to add it is therefore already done. No `UIBackgroundModes` entry is needed
  while the server sends notification messages rather than data-only ones.

On iOS the server's data fields do not reach `content.data`: Expo fills it from the payload's
`body` key, which only Expo's push service writes, and FCM puts the fields at the top level. The
service reads them from the push trigger's `payload` instead. A tap that opens the app without going
to the event, or a foreground notification that refreshes nothing, points here first.

Outside the repository, Firebase needs the APNs authentication key. Create a `.p8` key with the
Apple Push Notifications service enabled in the Apple Developer account, then upload it with its
Key ID and the Team ID in the Firebase console under Project settings, Cloud Messaging, Apple app
configuration. It goes to Firebase, not to EAS credentials, because the server sends through
Firebase Admin rather than Expo's push service. Without it, iOS still registers a token, but every
send to it fails.

None of this works in Expo Go. It needs a development or TestFlight build. iOS 16 or later
simulators on Apple silicon receive remote pushes, except the **iOS 26.0** simulator runtime: its
push daemon never connects to APNs ("has identity to connect? NO" in the simulator's `apsd` log),
so no app on it gets an APNs token, and Firebase then declines `getToken` with "APNS device token
not set before retrieving FCM Token". The app logs nothing, because token sync fails silently by
design. Use an iOS 26.1 or later simulator, which connected and issued a token within a minute
(verified on iOS 26.5, 2026-11-14), or a device. `xcrun simctl push <device> com.ganapps.app
<payload.json>` with the server's data keys at the top level of the payload, as FCM sends them,
exercises the banner, foreground refresh and tap routing without a server change.

### EAS cloud builds for iOS

`eas.json` has two store-signed iOS profiles. Both auto-increment the build number from the
same remote counter and pin the `macos-tahoe-26.6-xcode-27.2` image (Xcode 27.2, iOS 27 SDK):

| Profile | EAS environment | API and Remote Config | Use |
|---|---|---|---|
| `testflight` | `preview` | dev API, `mobile_dev` | Internal TestFlight — `eas build -p ios --profile testflight --auto-submit` |
| `production` | `production` | production API, `mobile_prod` | App Store release |

A `testflight` build is never the one submitted for App Review — it talks to the dev API.

Builds up to 1.1.1 (22) used `macos-tahoe-26.5-xcode-26.6` and the iOS 26.5 SDK. App Store
Connect accepted them with warning ITMS-90725: from April 2027, uploads must be built with the
iOS 27 SDK or later. Xcode 27 also requires the scene lifecycle (`enableSceneSupport`, above), so
the image and that setting change together ([ADR 0009](../../../home/docs/adr/mobile/0009-xcode-27-scene-support-on-sdk-57.md)).
Pin an exact image from [Expo's list](https://docs.expo.dev/build-reference/infrastructure/)
rather than an alias: `latest` and `sdk-58` move to new Xcode versions without a change here.

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
Motion & Fitness data. Check the resolved native configuration when this setting changes.

`microphonePermission: false` on `expo-camera` and `expo-image-picker` stays. expo-camera
contains audio-capture code, but Apple's ITMS-90683 check on build 3 listed only the motion key.
Re-check the processing email after upgrading either library.

**`NSPhotoLibraryUsageDescription` is written by two plugins**: `expo-image-picker` and
`expo-media-library`. Whichever runs last wins, and `photosPermission: false` on either one
deletes the key outright. For a while `expo-media-library` had `false`, which silently removed the
image picker's string from the resolved Info.plist. Both plugins must carry the same app-written
`photosPermission`. Check the resolved native configuration when either plugin changes. Saving the QR image uses the
separate `NSPhotoLibraryAddUsageDescription` (`savePhotosPermission`).

---
