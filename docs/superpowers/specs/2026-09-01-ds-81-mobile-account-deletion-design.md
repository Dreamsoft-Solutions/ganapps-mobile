# DS-81 — Mobile account deletion

**Date:** 2026-09-01
**Repository:** `ganapps-mobile`
**Branch:** `feat/ds-81-mobile-account-deletion` (standalone from `dev`)
**Owner:** Mobile client; depends on server DS-80
**Status:** Implementation-ready specification

## Outcome

A User can permanently deactivate the account from the authenticated mobile app. The
entry point is visible in Settings, the final action requires an exact typed confirmation,
and a successful (or already completed) server result clears the TanStack Query cache,
Zustand auth state, and all SecureStore tokens before routing to `Routes.auth.login`.
There is no support-email or browser hand-off.

The implementation PR must link the server DS-80 PR/commit in its description. The server
contract is a cross-repository dependency; this mobile branch does not invent or implement
the server operation.

The deletion entry must be reachable for both verified and authenticated unverified Users.
The current root layout keeps an unverified User on `Verify Email`, so that screen must expose
the same **Delete account** action without requiring email verification. The shared synthetic
fixture roles and setup are defined in
`docs/superpowers/specs/2026-09-01-app-store-manual-qa-fixtures.md`.

## Existing mobile anchors

- The Profile tab is `Routes.app.profile`; Settings is `Routes.profileSettings` and owns
  `src/app/(app)/(profile)/settings.tsx`.
- `authAPI` in `src/api/endpoints/auth.ts` uses `axiosInstance` and version-free paths.
- Auth query keys are `authQueryKeys.all` and `authQueryKeys.me()` in
  `src/hooks/queries/useAuthQuery.ts`.
- Auth mutations live in `src/hooks/mutations/useAuthMutation.ts`; `useAuth` is the
  aggregated surface in `src/hooks/useAuth.ts`.
- `useAuthStore.clearAuth()` already deletes the three SecureStore values through
  `secureStorage.clearTokens()` and clears the in-memory User.
- Use the existing `Button` destructive variant (the danger treatment), `Text`, `Card`,
  `ErrorView`, `Loading`, and `Empty` primitives. Do not add hard-coded colors or a new
  one-off destructive control.

## User flow

From the Profile tab, Settings is one tap away. The Settings screen exposes **Delete
account** as a visible destructive row/button; opening the deletion flow therefore takes
no more than two taps from the Profile tab. Confirmation taps are deliberate safety steps,
not hidden navigation.

1. The first confirmation sheet is headed **Delete your account?** and explains in plain
   language that the account, profile, friendships, registrations, saved Ganaps, and
   messages will be permanently deactivated/anonymised and cannot be restored. It states
   that signing out alone does not delete the account.
2. The sheet continues to a second confirmation state with the instruction **Type
   `DELETE MY ACCOUNT` to confirm.** The input must match exactly after trimming; case,
   spaces, and punctuation are not silently normalised. The final button is labelled
   **Delete account permanently**, uses the destructive/danger variant, and is disabled
   until the exact value is entered.
3. On submit, dismissing the keyboard is allowed but there is no optimistic logout and no
   silent retry. The button shows its loading state and rejects a second tap.
4. On a confirmed server result, clear the query client first, then call `clearAuth()` to
   remove SecureStore access, refresh, and expiry tokens, then `router.replace(Routes.auth.login)`.
   Use `replace`, never `push`, so Back cannot expose an authenticated screen.
5. Show a neutral completion state only briefly if needed; the next screen is login. Do not
   display deleted profile data or retain a cached chat/avatar image after the transition.

### Failure and repeat behavior

- A network/transport failure with no server response is an unknown outcome, not proof of
  deletion. Keep the confirmation state and typed value, show **We couldn't confirm account
  deletion. Check your connection and try again.**, and expose an explicit retry using the same
  idempotency key. Do not clear auth or claim completion until the server returns `DELETED` or
  `ALREADY_DELETED`; a committed operation is recovered by that same-key retry.
- A successful `202` response with `status: "ALREADY_DELETED"` means the server completed the
  operation earlier (possibly on another device). Treat it as completion, perform the same
  cache/token clear, and route to login. An already-deleted replay is a success response in the
  server contract, not a separate client failure state.
- A 401/expired session is not proof of deletion. Show **Your session expired. Sign in again
  to request account deletion.** and do not convert it into success. The normal interceptor
  may clear an expired session, but the deletion flow must not claim the account was deleted.
- A `SUPERADMIN_ACCOUNT_CANNOT_BE_DELETED` refusal shows **This account cannot be deleted.**
  Keep the User signed in, preserve the confirmation form and all cached/auth state, and do
  not navigate or clear tokens. This is a terminal role refusal, not a successful deletion.
- A server validation/conflict error leaves the User signed in and the confirmation state
  available. Render the typed API message through the normal error path.

## Server contract dependency (DS-80)

The server must land and document this contract in `docs/flags.md` before the mobile PR is
merged:

| Method | Path | Request | Success |
|---|---|---|---|
| `DELETE` | `/api/v1/auth/me` | Bearer access token, JSON `{ "confirmationPhrase": "DELETE MY ACCOUNT" }`, and an `Idempotency-Key` header (1–128 characters; a UUID is recommended) | `202` with `{ status: "DELETED" \| "ALREADY_DELETED", deletedAt: "<ISO-8601>", firebaseIdentityDeletion: "QUEUED" \| "NOT_LINKED" }` |

The mobile endpoint wrapper calls `/auth/me` through `axiosInstance`; the `/api/v1` prefix
and response-envelope unwrapping remain centralized. The body confirmation is sent by the
typed endpoint even though the UI has already required the same exact text. The same
idempotency key is reused when the User explicitly retries an ambiguous attempt, so a
committed deletion cannot be replayed as a new operation. Same-key replay returns the same
successful `202` payload. The response is the inner payload after the interceptor, not the
envelope.

The typed response is:

```typescript
type DeleteAccountResponse = {
  status: 'DELETED' | 'ALREADY_DELETED';
  deletedAt: string;
  firebaseIdentityDeletion: 'QUEUED' | 'NOT_LINKED';
};
```

The server operation must be atomic from the caller's point of view. The
`firebaseIdentityDeletion` disposition is operational metadata only; either
`QUEUED` or `NOT_LINKED` is a successful client outcome:

- Set `User.deletedAt`, make the account unfindable for login and refresh, revoke every
  refresh token, and invalidate any access-token/session blacklist required by the server.
- Remove or anonymise credentials and provider linkage. For a Google-linked User, revoke or
  delete the corresponding Firebase identity so the Google account cannot create an orphaned
  sign-in path.
- `Registration`, `Attendance`, and `GanapRating` history remains for event integrity but is
  detached from personally identifying display data. Private `FormAnswer` rows are deleted;
  they are not retained as account history and cannot be used to authenticate the deleted
  User.
- Delete `PushToken` rows and pending notification deliveries for the User.
- Remove friend edges (including pending requests) from active social lists.
- Preserve operational chat history and media as anonymised records. Messages authored by the
  deleted User must render as **Deleted User** without a profile link; associated chat media
  remains available under that anonymised ownership according to the chat retention policy.
  A deletion must not allow sign-in or reactivation through an old message or media URL.
- Replay a known, already-deleted subject as `202` with `status: "ALREADY_DELETED"` and the
  original deletion metadata. It must not return a generic success for a different User ID or
  expose whether another account exists.

Required error shape is the existing global error envelope, with `errorCode` and
`statusCode`. DS-80 documents `ACCOUNT_DELETION_CONFIRMATION_REQUIRED`,
`IDEMPOTENCY_KEY_REQUIRED`, `IDEMPOTENCY_KEY_REUSED`, `UNAUTHORIZED`,
`SUPERADMIN_ACCOUNT_CANNOT_BE_DELETED`, `FEATURE_DISABLED`, and
`ACCOUNT_DELETION_FAILED` behavior. The mobile error parser must preserve the code/status; no
string matching is permitted.

## Client layers and cache rules

The implementation follows the repository's three layers:

1. Add a typed `DeleteAccountResponse` to the auth types and
   `authAPI.deleteAccount(confirmationPhrase: string, idempotencyKey: string):
   Promise<DeleteAccountResponse>` in `src/api/endpoints/auth.ts`. It uses
   `axiosInstance.delete('/auth/me', { data: { confirmationPhrase }, headers: {
   'Idempotency-Key': idempotencyKey } })` and returns the inner `data` value. Add endpoint
   tests before implementation tests for path, method, exact body, header, and envelope
   unwrapping.
2. Add `DeleteAccountInput` with `confirmationPhrase` and `idempotencyKey`, then add
   `useDeleteAccountMutation()` in `src/hooks/mutations/useAuthMutation.ts`, returning
   `UseMutationResult<DeleteAccountResponse, Error, DeleteAccountInput>`. It must invalidate/
   clear no feature selectively: account deletion is a session boundary, so the aggregated
   handler owns `queryClient.clear()` after success or the `ALREADY_DELETED` terminal result.
3. Extend `UseAuthResult`/`useAuth` with a named deletion action or keep the Settings screen
   on the mutation's typed result; whichever is chosen, navigation remains owned by the
   aggregated auth surface and uses `Routes`, not a string literal. Include the deletion
   pending/error state in the screen contract.

Do not enqueue this operation in `outbox`, `sync.service`, or SQLite. A deletion is an online
destructive transaction; if connectivity is absent, the explicit retry state is the honest
result. After cache clear, no auth or chat query may refetch because `enabled: !!token` is
false and SecureStore is empty.

## Accessibility and layout

- The destructive control has an accessibility role of button, label **Delete account**, and
  a hint explaining that it opens an irreversible confirmation. The final button's label is
  **Delete account permanently** and its busy/disabled state is exposed while loading.
- The typed field has a visible label, secure keyboard-safe focus behavior, and an inline
  mismatch message. The keyboard must not cover the final action; use safe-area insets and a
  keyboard-aware scroll surface.
- Use semantic design tokens and the existing primitives in both light and dark themes.
  Respect the user's font scale: the copy wraps, controls remain reachable, and no text is
  clipped. Keep the Profile/Settings header below the safe area.
- No emoji, icon-only destructive action, external URL, or support-email fallback is used.

## Automated tests (write first)

- Endpoint test: fake Axios adapter verifies `DELETE /api/v1/auth/me`, the exact
  `confirmationPhrase` body, the idempotency header, the typed inner `202` response, and
  same-key replay as `status: "ALREADY_DELETED"`; typed confirmation, idempotency, auth, and
  server-failure errors remain distinguishable.
- Mutation test: success invokes the server once, exposes pending state, and does not queue
  an outbox write; terminal already-deleted follows the same completion path.
- Cache/auth integration test: after completion `queryClient.clear()` runs, all three secure
  token keys are deleted, the auth store has `token === null`/`user === null`, and navigation
  uses `Routes.auth.login`.
- Screen/flow tests: Delete account is discoverable from Settings and Verify Email for an
  authenticated unverified User, the final button stays disabled for near-miss text, the
  danger action requires both confirmation states, network failure retains the form and retry,
  a SuperAdmin refusal leaves the User signed in with no state change, and a double tap creates
  one request.
- Accessibility test: labels, role, busy/disabled state, and wrapped irreversible copy are
  present at the default and enlarged font scales.

## Android manual journey

Run on a connected Android emulator with the display awake. Resolve its current serial with
`adb devices -l` and use that value for every command; do not couple the journey to an AVD
name or a serial that Android may reassign. Use
`android layout --device <device-serial> --pretty` as the primary assertion tool; capture
a screenshot only as secondary visual evidence. Capture it with
`android screen capture --device <device-serial> -o <evidence-path>.png`. Never use the named
SuperAdmin, Business, or User QA accounts for a destructive journey. Use the disposable
`ds81-delete-verified`, `ds81-delete-unverified`, and `ds81-delete-superadmin` fixture roles
from `docs/superpowers/specs/2026-09-01-app-store-manual-qa-fixtures.md`, created for the run.

The later CLI runner captures layout JSON before and after each XML action. Use element centers
or bounds from that JSON with `adb -s <device-serial> shell input tap <x> <y>`, slow scrolls with
`adb -s <device-serial> shell input swipe <x1> <y1> <x2> <y2> 500`, and
`adb -s <device-serial> shell input text` only after the
layout reports the field focused. Capture a secondary image with
`android screen capture --device <device-serial> -o <evidence-path>.png` only when visual
confirmation is needed. If
the disposable fixture cannot be provisioned, stop before the destructive action.

```xml
<journey name="DS-81 account deletion">
  <description>Verify the in-app irreversible account-deletion flow and safe terminal state.</description>
  <actions>
    <action>Sign in with ds81-delete-verified and verify that the authenticated Profile tab is visible.</action>
    <action>Tap Settings.</action>
    <action>Verify that Delete account is visible without opening an external page.</action>
    <action>Tap Delete account.</action>
    <action>Verify that the first confirmation explains permanent deletion and cannot be undone.</action>
    <action>Continue to the typed confirmation.</action>
    <action>Verify that Delete account permanently is disabled until the exact text DELETE MY ACCOUNT is entered.</action>
    <action>Enter DELETE MY ACCOUNT and verify that the destructive button is enabled.</action>
    <action>Tap Delete account permanently once.</action>
    <action>Verify that a loading state prevents a second submission.</action>
    <action>Verify that the login screen is shown and the authenticated Profile screen is not reachable with Back.</action>
  </actions>
</journey>
```

```xml
<journey name="DS-81 unverified account deletion access">
  <description>Verify an authenticated unverified User can reach and complete in-app deletion from Verify Email.</description>
  <actions>
    <action>Sign in with ds81-delete-unverified and verify the Verify Email screen is shown.</action>
    <action>Verify Delete account is visible without requiring email verification or an external page.</action>
    <action>Tap Delete account.</action>
    <action>Verify the first confirmation explains permanent deletion and cannot be undone.</action>
    <action>Continue to the typed confirmation, enter DELETE MY ACCOUNT, and verify the destructive button enables only for the exact value.</action>
    <action>Tap Delete account permanently once.</action>
    <action>Verify the login screen is shown and the authenticated screen is not reachable with Back.</action>
  </actions>
</journey>
```

```xml
<journey name="DS-81 SuperAdmin deletion refusal">
  <description>Verify the protected synthetic SuperAdmin role remains signed in when deletion is refused.</description>
  <actions>
    <action>Sign in with ds81-delete-superadmin and verify the authenticated Profile tab is visible.</action>
    <action>Tap Settings and open Delete account.</action>
    <action>Complete both confirmation states with the exact text DELETE MY ACCOUNT.</action>
    <action>Tap Delete account permanently once and verify the typed refusal copy is shown.</action>
    <action>Verify the User remains signed in, the confirmation form remains available, and no logout or navigation occurs.</action>
  </actions>
</journey>
```

The test report records the layout JSON, fixture label, and server outcome. If a disposable
fixture cannot be provisioned, stop before the destructive tap; never substitute a named
account.
