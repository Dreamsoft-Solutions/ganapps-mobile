# ADR 0008: iOS Push Tokens Come From Firebase Messaging, Linked on iOS Only

**Date:** 2026-11-12
**Status:** Accepted

## Context

The server sends every push through Firebase Admin `sendEach`
(`ganapps-server/src/modules/notifications/push-token.sender.ts`), so each registered token must be
a Firebase Cloud Messaging (FCM) registration token. On Android, `expo-notifications`'
`getDevicePushTokenAsync()` returns one. On iOS it returns the raw APNs device token, which FCM
rejects. Until DS-135 every registration path in `push-notification.service.ts` stopped off
Android, so iOS users received no notifications at all.

`@react-native-firebase/messaging` turns the app's APNs registration into an FCM token. Installing
it also changes how both platforms receive notifications, beyond what its JavaScript API suggests:

- **Android.** Its manifest declares `ReactNativeFirebaseMessagingService` for
  `com.google.firebase.MESSAGING_EVENT` at the default priority. `expo-notifications` declares
  `ExpoFirebaseMessagingService` for the same action at priority `-1`. Android delivers the intent
  to the higher-priority service, so linking the package would take every incoming push away from
  `expo-notifications`, which owns the `registration-status` channel, the foreground listener and
  tap routing.
- **iOS.** When the app finishes launching, the package makes itself the `UNUserNotificationCenter`
  delegate and keeps `expo-notifications`' `NotificationCenterManager` as the original delegate,
  forwarding every callback to it. Taps (`didReceive`) are forwarded with the completion handler
  untouched, so `expo-notifications` still receives them, cold start included. `willPresent` is
  different: after forwarding, it calls the completion handler itself, synchronously, with the
  options in `firebase.json`'s `messaging_ios_foreground_presentation_options`, which default to
  none. Once `setNotificationHandler` has run, at root mount, `expo-notifications` answers later,
  after the JavaScript `handleNotification` resolves, so the package's answer comes first. Without
  that key, iOS would show no foreground banners.
- **Where the data lands on iOS.** For a remote notification, `expo-notifications` fills
  `content.data` only from the payload's `body` key, which is where Expo's own push service puts
  data (`NotificationRecords.swift`). FCM puts the server's fields at the top level of the APNs
  payload instead, next to `aps`, `gcm.message_id` and `google.c.*`. So on iOS `content.data` is
  empty, and both tap routing and the foreground cache refresh would silently do nothing. The full
  payload is available as the trigger's `payload`.

iOS shows its notification permission prompt once per install, and only Settings can reverse a
denial. Android has asked on the first signed-in launch since push shipped (`78f781d`).

## Decision

1. iOS gets its token from `@react-native-firebase/messaging`, pinned to the same 25.1.0 as the
   other React Native Firebase packages, through the modular API (`getMessaging`, `getToken`,
   `onTokenRefresh`), and registers it with `platform: 'ios'`. The package's default
   registration with APNs at launch stays on. Registering does not prompt.
2. The package is linked on iOS only. `react-native.config.js` sets its `android` platform to
   `null`, so Android still gets its token from `expo-notifications`, as before. `RNFBMessaging`
   joins `forceStaticLinking` (ADR 0002).
3. `expo-notifications` still owns permission requests, foreground display, tap handling and the
   cold-start response. `firebase.json` sets `messaging_ios_foreground_presentation_options` to
   `banner`, `list` and `sound`, the same behavior `configureNotificationHandling` returns from
   `handleNotification`. On iOS, when `content.data` holds no valid fields, the service reads them
   from the push trigger's `payload`, keeping only the supported keys
   (`pickNotificationDataFields`). Android still reads `content.data` only.
4. iOS asks for notification permission in context, right after a registration completes: a join
   that needs no form, or a submitted registration form (`requestPushPermissionInContext`). The
   signed-in sync only reads the permission: at sign-in, on every Firebase token refresh, and each
   time the app returns to the foreground. The foreground check covers a User who turns
   notifications on in Settings later, and a registration that failed. It sends each token at most
   once per sign-in. Android keeps asking on the first signed-in launch, because DS-135 requires
   Android to behave exactly as before.
5. Logout waits for `DELETE /push-tokens` before it sends `POST /auth/logout`, with each request
   attempt capped at five seconds. Logout puts the access token on the server's revocation list,
   and a revoke that arrives after it is rejected with 401. When the two requests ran concurrently,
   the tokens were left registered whenever logout reached the server first. The revoke also
   suspends token registration until the next sign-in, so a token rotated during logout is not
   registered again for the User signing out.

## Alternatives Considered

1. **Register the APNs token and have the server send through APNs.** Rejected because the server
   sends only through FCM. It would need a second sender and its own APNs credentials, and the
   server is not this repository's to change.
2. **Link the package on Android as well and move Android onto it.** Rejected because it rewrites
   the Android push path that works today: the package's service would receive Android pushes, and
   channel setup, foreground handling and tap routing would all need re-verifying. DS-135 asks for
   Android to stay unchanged.
3. **Ask on iOS at launch, as Android does.** Rejected because the prompt would appear before the
   User has any reason to want notifications, and iOS allows one attempt. DS-49's compliance note
   asks for the prompt at the first registration.
4. **A custom explanation screen before the system prompt.** Deferred. It needs a design, and it can
   be added later in front of `requestPushPermissionInContext` without changing this decision.
5. **`expo.autolinking.exclude`.** Rejected because it unlinks the package on both platforms, and
   iOS needs it.
6. **Keep the push-token revoke fire-and-forget so it never delays logout.** Rejected because it is
   the cause of the 401 above. The five-second bound caps the delay instead.
7. **Read notification data from RNFB's `onMessage` and `onNotificationOpenedApp`.** Rejected
   because it would split delivery handling between two libraries on iOS only. Reading the
   trigger payload keeps one path through `expo-notifications` on both platforms.

## Consequences

- Android's autolinking output lists the same React Native Firebase modules as before: `app`,
  `auth` and `remote-config`. Check `npx expo-modules-autolinking react-native-config --platform
  android` when React Native Firebase changes.
- On iOS, `firebase.json` decides foreground presentation for every notification, not
  `handleNotification`. Change the two together. The app schedules no local notifications today.
  If it starts to, they get the same options.
- The `null` override holds only while `@react-native-firebase/messaging` ships no
  `react-native.config.js` of its own, the same caveat as ADR 0006. Version 25.1.0 ships none.
- Foreground display and tap routing with both libraries installed are verified on a device, not in
  CI.
- Firebase needs the APNs authentication key (`.p8`) with its Key ID and Team ID under Project
  settings, Cloud Messaging, Apple app configuration. It goes to Firebase, not EAS credentials,
  because the server sends through Firebase Admin.
- The server's messages carry no `apns` block, so iOS notifications arrive without sound. Adding
  `apns.payload.aps.sound = 'default'` is a server change.
- A User who denies the prompt is never asked again. Enabling notifications in iOS Settings
  registers the token the next time the app comes to the foreground.
- The notification data contract now has two readers on iOS: `content.data` and the trigger
  payload. A new data field the server adds must also be added to `NOTIFICATION_DATA_KEYS`, or
  `parseNotificationData` rejects the notification on both platforms, as before.
- `DELETE /push-tokens` removes every token the User has, on every device, so signing out on one
  device stops pushes to all of them. That is the server's contract and is unchanged here. Because
  each sign-in sends its iOS token once, a token the server removes this way, or drops after FCM
  reports it invalid, comes back on that device's next launch, not on its next foreground.
- Logout can take longer on a slow network: five seconds per revoke attempt. A token refresh
  before or after a 401 is not covered by that cap, since it uses its own request with no timeout,
  as logout's refresh always has. If logout itself fails after the revoke succeeded, the User stays
  signed in with no registered token until the next sign-in or launch.
