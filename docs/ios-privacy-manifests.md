# iOS privacy manifests

Audited on October 12, 2026 for DS-93, against `dev` after DS-92 (Firebase Analytics unlinked),
React Native 0.86.0, Expo SDK 57, static frameworks and `usePrecompiledModules: false`. The evidence
is a clean `npx expo prebuild`, its `ios/Podfile.lock`, and a Debug simulator build.

This records what the native SDKs declare and call. It is not the App Privacy label and not legal
advice; DS-83 owns the label and the collected-data part of the manifest.

## Limits

- Only a Debug simulator build was scanned. A Release device build was not; it strips some
  development-only code, so its API use is expected to be a subset.
- Release builds 1.0.1 (4) to 1.1.0 (6) processed in App Store Connect with no ITMS-91053 (missing
  API declaration) or ITMS-91061 (missing SDK manifest) email. The next TestFlight build's
  processing is the confirmation for this change.

## How manifests reach the app

- **Pod resource bundles.** Most SDKs ship `PrivacyInfo.xcprivacy` in a resource bundle such as
  `FirebaseCore_Privacy.bundle`: 28 in the built app, counting MapboxMaps' `MapboxMapsResources`,
  which is copied inside `MapboxMaps.framework`.
- **Vendored and prebuilt frameworks.** MapboxCommon, MapboxCoreMaps and ReactNativeDependencies
  carry their manifests inside the framework: 5 more files.
- **The app manifest.** `expo prebuild` writes `ios.privacyManifests` from `app.config.js` into
  `ios/Ganapps/PrivacyInfo.xcprivacy`. `pod install` then runs React Native's
  `PrivacyManifestUtils.add_aggregated_privacy_manifest`, which adds the required reasons from every
  pod resource bundle, plus React Native core's fixed set (`C617.1`, `CA92.1`, `35F9.1`), and
  removes duplicates. It does not read manifests inside vendored or prebuilt frameworks; those stand
  on their own.
- Aggregation is on by default. It is controlled by `expo-build-properties`'
  `ios.privacyManifestAggregationEnabled` in `app.config.js`, which prebuild writes to the generated
  `ios/Podfile.properties.json`. Leave it unset or `true`.

## Required Reason APIs

Checked by listing the symbols each binary in the built app imports (`nm -u`) and the selectors it
names (`systemUptime`, `activeInputModes`), then comparing them with the manifests that cover that
binary.

| Binary | Categories used | Declared by |
|---|---|---|
| `Ganapps` (`Ganapps.debug.dylib` in Debug; all statically linked pods) | File timestamp, system boot time (`systemUptime`), disk space, user defaults | App manifest |
| `React.framework` (prebuilt core, no manifest inside) | File timestamp, system boot time, user defaults | App manifest, through React Native core's fixed set |
| `MapboxCommon`, `MapboxCoreMaps` | File timestamp, disk space, user defaults | Their own manifests |
| `MapboxMaps` | User defaults | Its own resource bundle |
| `ReactNativeDependencies` | File timestamp | Its own bundles |
| `ExpoModulesJSI`, `hermesvm`, `Turf` | None | Not needed |

Nothing uses the active keyboard category.

Apple says a third-party SDK "can't rely on the privacy manifest files for apps that link" it.
`React.framework` has no manifest of its own, so its coverage rests on the app manifest. Builds 4 to
6 processed without an ITMS-91053 email, which is the evidence that App Store Connect accepts this
today; it is not a guarantee.

### Pods whose code needs reasons they don't declare

31 of the 156 root pods in `Podfile.lock` ship a manifest; 125 don't, and most of those call no
Required Reason API. A pod that ships a manifest can still under-declare. These need a reason from
the app manifest:

| Pod | Own manifest | Category | Use | Reason |
|---|---|---|---|---|
| `AsyncStorage` (vendored `SharedAsyncStorage.xcframework`, Kotlin Multiplatform with SQLite) | File timestamp only | Disk space | `statfs`, `fstatfs` | `E174.1` |
| `ExpoSQLite` (vendored `sqlite3.c`) | None | File timestamp | `stat`, `fstat`, `lstat` on database files in the app container | `C617.1` |
| `ExpoSQLite` | None | Disk space | `fstatfs` to detect the volume's filesystem type | `E174.1` |
| `RNFBApp` | None | User defaults | `RNFBPreferences`, its own defaults suite | `CA92.1` |
| `RNFBAuth` | None | User defaults | `standardUserDefaults` | `CA92.1` |
| `rnmapbox-maps` | None | User defaults | Stores the Mapbox telemetry opt-out | `CA92.1` |
| `React-CoreModules`, `React-RCTSettings`, `React-jsi` | None | User defaults, file timestamp | Dev settings, `Settings`, JSI file buffers | `CA92.1`, `C617.1` |
| `React-Core-prebuilt` (`React.framework`) | None | System boot time | `mach_absolute_time` | `35F9.1` |

ExpoSQLite compiles with `SQLITE_ENABLE_LOCKING_STYLE=0`, so its other `statfs` paths are not built.

No Apple disk space reason describes reading filesystem flags. `E174.1` (check disk space before
writing files) is the closest, and ExpoFileSystem and Mapbox already declare it.

Not counted: `ExpoSharing` reads App Group defaults only when receiving shares, and the app has no
App Group entitlement. RNFBAuth's `creationDate` is Firebase account metadata, not a file timestamp.
`libdav1d` calls `mach_absolute_time` only in its command-line tool, which is not compiled in.

`app.config.js` declares these four reasons itself under `ios.privacyManifests`, and
`app.config.test.ts` pins them. Other SDK manifests and React Native core already declared the same
reasons, so after `npx expo prebuild --clean` the generated manifest lists the same categories and
reasons as before. Its only new key is an empty `NSPrivacyTrackingDomains` array, which Expo always
writes. Declaring the reasons in `app.config.js` keeps the manifest correct if another SDK's
manifest changes or aggregation is turned off.

## Apple's commonly used SDK list

Apple requires a privacy manifest, and a signature for binary dependencies, from SDKs on its
[third-party SDK list](https://developer.apple.com/support/third-party-SDK-requirements/). The app
links 15 of them, all with a manifest: AppAuth, PromisesObjC (FBLPromises), PromisesSwift
(Promises), FirebaseABTesting, FirebaseAuth, FirebaseCore, FirebaseCoreExtension,
FirebaseCoreInternal, FirebaseInstallations, FirebaseRemoteConfig, GoogleSignIn, GoogleUtilities,
GTMAppAuth, GTMSessionFetcher and SDWebImage.

`hermes-engine` matches the list's "hermes" by name but is not the listed SDK. That entry is Imgur's
SDK, as an Apple DTS engineer confirmed in
[Apple Developer Forums thread 759394](https://developer.apple.com/forums/thread/759394) (July
2024). `hermes-engine` ships neither a manifest nor a signature, and `hermesvm` imports no Required
Reason API. No action is needed.

## Collected data declared by SDKs

Input for DS-83's App Privacy label. SDK manifests describe what the SDK collects; the label must
account for it.

| SDK | Declared data types |
|---|---|
| MapboxCommon | Coarse Location, Precise Location, User ID, Product Interaction, Other Usage Data, Performance Data, Other Diagnostic Data |
| MapboxMaps | User ID, Precise Location, Coarse Location |
| GoogleSignIn | Name, Email Address, Phone Number, Other Data Types, Coarse Location, User ID, Device ID, Other Usage Data |
| FirebaseAuth | Other Diagnostic Data, User ID |
| FirebaseInstallations, FirebaseRemoteConfig | Other Diagnostic Data |

No SDK manifest declares tracking or tracking domains. Each manifest also says whether a type is
linked to the user and for what purpose; read those from the files when filling in the label.

## Re-check

Re-run after an Expo SDK, React Native or React Native Firebase upgrade, and after adding any native
module. Build and install on a booted simulator first (`npx expo prebuild --clean`, then
`npx expo run:ios`), and run these from the repository root. They work in bash and zsh.

```bash
APP=$(xcrun simctl get_app_container booted com.ganapps.app)
find "$APP" -name PrivacyInfo.xcprivacy
plutil -p ios/Ganapps/PrivacyInfo.xcprivacy
find "$APP" -maxdepth 3 -type f \( -name Ganapps -o -name Ganapps.debug.dylib -o -path '*/Frameworks/*.framework/*' \) | sort | while read -r bin; do
  file -b "$bin" | grep -q Mach-O || continue
  echo "== ${bin#"$APP"/}"
  { nm -u -j "$bin" 2>/dev/null; strings -a "$bin" | grep -xE 'systemUptime|activeInputModes'; } \
    | grep -E '^_(stat|fstat|lstat|fstatat|getattrlist|statfs|statvfs|fstatfs|fstatvfs|mach_absolute_time)$|NSUserDefaults|NSFileSystem|NSURLVolume|^(systemUptime|activeInputModes)$' | sort -u
done
```

Debug builds put the app's code in `Ganapps.debug.dylib`; Release builds put it in `Ganapps`. Any
category a binary uses that neither the app manifest nor that binary's own manifest declares needs a
reason in `ios.privacyManifests`, whether or not the pod ships a manifest.
