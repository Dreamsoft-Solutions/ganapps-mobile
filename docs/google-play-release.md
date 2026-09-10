# Google Play release readiness

Reviewed against `../Google_Play_Publishing_Requirements.docx` on September 10, 2026.
The repository changes prepare the Android release; they do not establish publication readiness.
Do not submit until the unresolved items below have evidence.

## Implemented

- Preserve the registered application ID `com.ganapps.app` and app version `1.0.0`.
- EAS production explicitly uses the production environment, an Android App Bundle, remote version management, and automatic version increments. Local `versionCode: 1` is only the initial fallback; synchronize EAS with any previously uploaded Play version before the first build.
- The installed React Native 0.86 Android version catalog specifies compile/target SDK 36. No SDK override or dependency upgrade is needed. Verify the final AAB manifest independently.
- Production disables local cleartext traffic and environment feature-flag overrides, and selects `mobile_prod` Remote Config.
- The Android production EAS post-install check rejects missing/insecure public URLs, local API hosts, non-production flags, missing public Mapbox tokens, and missing Android Firebase/OAuth configuration. It validates configuration shape, not service ownership, availability, or the correct signing fingerprint.
- Login and Settings expose Terms and Privacy Policy. Settings exposes **Delete account**, opening the configured public deletion request resource. This only opens a request page; it neither deletes data nor claims deletion succeeded.
- Avatar and chat image selection use Expo's system picker without asking for broad photo-library access. QR image selection already used this path.
- Android manifest merge rules remove microphone, overlay, broad media, and legacy shared-storage permissions. Camera access remains for QR scanning; notification permission remains managed by the notification SDK.

## Required configuration and services

### Expo account access

On September 10, 2026, `eas whoami` reported `lump1a`, but `eas project:info`
returned `Entity not authorized` for this app's configured EAS project.
Production environment and Android build history could not be read.

The `dreamsoft-cpu` project owner must grant that account appropriate project access,
or the release operator must sign in with an authorized account:

```powershell
eas login
eas whoami
eas project:info
```

Run these from `ganapps-mobile`. Do not create a replacement project or change
the registered application ID to bypass the access issue. Keep credentials out of chat.

### Deletion request option

Google explicitly permits a public deletion resource with a customer-service email
or request form, linked from inside the app. This can avoid building an automatic
deletion endpoint initially. It still requires a monitored inbox, requester verification,
actual deletion of associated data and provider-held copies, and disclosed retention.
The operator must confirm who handles requests and the fulfilment/retention policy
before this is presented as an available service.
See [Google's deletion resource requirements](https://support.google.com/googleplay/android-developer/answer/13327111).

### Environment values

Set these in the EAS **production** environment before building:

| Variable | Required value |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | Production HTTPS API ending in `/api/v1` |
| `EXPO_PUBLIC_PRIVACY_POLICY_URL` | Published, publicly accessible Ganapps privacy policy |
| `EXPO_PUBLIC_TERMS_URL` | Published Ganapps terms, including applicable user-content rules |
| `EXPO_PUBLIC_ACCOUNT_DELETION_URL` | Public resource that actually accepts account and associated-data deletion requests |
| `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` | Runtime public `pk.` token |
| `GOOGLE_SERVICES_JSON` | File variable for the production Android Firebase configuration |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Correct web OAuth client ID, unless supplied by the Firebase file |

The production profile supplies `APP_ENV=production`, `EXPO_PUBLIC_FEATURE_FLAG_ENV_OVERRIDE=false`, and `EXPO_PUBLIC_FEATURE_FLAG_REMOTE_CONFIG_PARAMETER=mobile_prod`.
Public Expo variables are bundled into the app: never put private keys, service-account credentials, or Mapbox `sk.` tokens in them.

**Deletion is unresolved:** the inspected mobile/server code contains no account-deletion API. The owner must supply a working request service and approved retention rules, or authorize a defined server deletion contract. A page describing deletion without accepting requests is insufficient. The service must verify the requester, delete associated data, and disclose any justified retention. Do not treat logout, blocking, deactivation, or removing SecureStore tokens as account deletion.

**Privacy is unresolved:** obtain approved policy copy and support/privacy contact information. Verify the actual deployed pages without authentication; do not ship placeholders. The build check deliberately blocks production when URLs are absent. Providing syntactically valid URLs alone does not resolve these requirements.

## Data safety evidence to reconcile

This is an inventory for the declaration owner, not a completed Data safety form. Confirm collection, sharing, purpose, optionality, deletion, and encryption against the deployed backend and each SDK.

| Surface observed in code | Data to review |
| --- | --- |
| Account/profile API and Google/Firebase sign-in | Email, username, names, user IDs, credentials/tokens, profile image, interests, biography |
| Registrations, QR check-in, and feedback | Event participation, attendance, form answers and ratings; organizer-defined forms may request additional data |
| Event and Direct Chat, friends, presence | Messages, selected images, social relationships, coarse activity, read receipts and reactions |
| Moderation | Reports, blocked users, report details and evidence retention |
| Push registration and Firebase | Device push token, device/app identifiers and SDK diagnostics; inspect provider configuration |
| Mapbox | Map/network requests and SDK telemetry; confirm current SDK disclosures and user controls before declaring location or diagnostics behavior |
| SecureStore, AsyncStorage, SQLite and query caches | Tokens/preferences and cached data; establish cleanup and retention for the final deletion implementation |

No advertising or billing SDK was identified in `package.json`; the owner must still confirm the app's actual advertising and monetization behavior. Event coordinates are not evidence that device location is collected. Do not infer that SDK collection is absent just because application code does not explicitly send it.

## Store listing draft

- Name: **Ganapps**
- Short description: **Discover campus events, register, and connect with friends.**
- Full description draft: **Find campus events on the map, explore event details, and register from your phone. Keep track of your joined events, see organizer announcements, and chat with other attendees. Connect with friends, check in by scanning the organizer's QR code, and share feedback after attending.**

Confirm listing claims against the production feature flags. The owner must supply category, support email, website, audience, content rating, and ads declarations.
Prepare a 512 × 512 PNG store icon within 1,024 KB, a 1,024 × 500 JPEG or 24-bit PNG feature graphic without alpha, and accurate release screenshots. Existing launcher artwork does not establish that these store assets are ready. Do not fabricate screenshots or reviewer credentials.

## Release verification and handoff

1. Complete developer identity/contact verification and confirm the appropriate organization or personal account and app permissions.
2. Configure the production values above; verify the privacy and deletion service, retention rules, and support contact.
3. Configure Play App Signing and secure the upload key. Register the **Play app-signing** SHA-1/SHA-256 certificates in Firebase/Google OAuth, not only the upload/debug certificate. Download the updated Android config. Verify server OAuth audience and native sign-in against a Play-delivered build.
4. Run `npm run check`, `npm run type-check`, `npm run test -- --runInBand`, and `npm run test:play-release`. Run `npm run check:play-release` with production values to verify configuration. A normal local `.env` should fail this last check.
5. Build using `eas build --platform android --profile production`. Inspect the signed AAB's application ID, version, target API 36 or newer, merged permissions, release endpoints, and native libraries. Verify 64-bit and **16 KB page-size compatibility** for every packaged native library, including Mapbox; the JavaScript version or configuration alone is not proof.
6. Upload to Internal testing. Test the exact Play-installed build on devices: password/Google sign-in, registration/email verification, API/map connectivity, QR camera denial/retry, photo selection/cancellation with library permission denied, chat/report/block, notifications, deep links, privacy pages, and the complete deletion request/fulfilment process. Verify startup, accessibility, back navigation, offline/error states, and 16 KB devices.
7. Provide working reviewer access to all gated features and clear instructions, including any verification or organization membership requirements. Complete Data safety, content rating, audience, ads and relevant sensitive-permission forms.
8. If the personal account is subject to the closed-testing rule, complete at least 12 continuously opted-in testers for the preceding 14 days and apply for production access. Internal testing does not replace that requirement.
9. Resolve all Play checks, prepare release notes, and obtain release-owner approval before production submission or rollout.

## Sources

- [Target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878)
- [User data and account deletion](https://support.google.com/googleplay/android-developer/answer/10144311)
- [Photo and video permission policy](https://support.google.com/googleplay/android-developer/answer/14115180)
- [Android 16 KB page sizes](https://developer.android.com/guide/practices/page-sizes)
- [Expo ImagePicker](https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/)
- [Store assets](https://support.google.com/googleplay/android-developer/answer/9866151)
- [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469)
- [Personal account testing](https://support.google.com/googleplay/android-developer/answer/14151465)

Recheck live Play Console policy status immediately before submission.
