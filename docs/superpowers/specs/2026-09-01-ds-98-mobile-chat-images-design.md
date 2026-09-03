# DS-98 — Chat images from the existing library

**Date:** 2026-09-01
**Repository:** `ganapps-mobile`
**Branch:** `feat/ds-98-mobile-chat-images` (from `feat/ds-96-mobile-chat-moderation`)
**Depends on:** DS-95 Event Chat, DS-96 moderation UI, and the server DS-97 media contract
**Feeds:** shared Event/Direct message renderer used by the DS-99 branches
**Status:** Implementation-ready specification

The implementation PR must list the exact server DS-97 upload/message contract and its
cross-repository PR/commit in the description. The old ticket text mentions photos and videos;
this locked mobile scope deliberately ships **one image only**. Video, camera capture, and
microphone access are deferred and must not be enabled by this branch.

## Outcome and boundaries

A User can select one existing library image, inspect it, remove it, and send it in an Event
Chat. The same renderer and upload result are reusable for Direct Chat when DS-99 lands. The
server returns canonical message/media metadata; the client does not invent a public URL or
optimistically mark an image as sent.

The shared synthetic fixture roles and image corpus are defined in
`docs/superpowers/specs/2026-09-01-app-store-manual-qa-fixtures.md`. Fixture provisioning,
network changes, and signed-URL expiry responses are test setup performed outside the UI
journey.

The upload contract accepts JPEG, PNG, and WebP inputs no larger than 5 MiB (5,242,880 bytes);
the server determines whether a WebP is static after decoding. GIF, HEIC/HEIF, video, camera
capture, multiple selection, and in-app recording are out of scope. An animated WebP may pass
the local MIME/size pre-check but is rejected by the server as malformed. The server repeats
every restriction and runs the media safety decision before the message becomes visible.

There is no SQLite chat outbox. If upload or message creation fails, keep the selected asset
as an explicit failed draft with a clear **Retry image** action. A failed image is not silently
discarded, and no background service replays it.

## Existing mobile anchors and permission boundary

- `expo-image-picker` is already installed and configured in `app.config.js`; use it for an
  existing-library selection with image media types and `allowsMultipleSelection: false`.
- `expo-media-library` is not needed and must not be added. The app reads a picker result; it
  does not create albums or save files.
- `microphonePermission: false` remains correct. No `NSMicrophoneUsageDescription`, camera
  permission, or new native permission is introduced. The only camera use in the app remains
  QR check-in.
- The attachment control lives in the DS-95 composer. Use existing `Button`, `IconButton`,
  `Card`, `Text`, `Loading`, `ErrorView`, and `Empty` primitives with semantic design tokens.
  The report action from DS-96 must be present on an image bubble exactly as it is on text.

## User experience and state machine

The local draft states are `none`, `ready`, `checking`, `retryable-failure`, and
`permanent-failure`. Picker acceptance enters `ready`; only the Send action can enter
`checking`; a canonical response clears the draft, while retryable and permanent failures
keep the preview available for an explicit retry or removal, respectively. There is no
persisted `checking` message.

1. The composer has a labelled **Add image** button. On permission denial, show a concise
   explanation and a path to the operating-system setting only if the picker supplies one;
   do not request unrelated media/camera/microphone permissions.
2. The picker opens for one image. Immediately inspect the local `mimeType` and `fileSize`.
   Reject only a known disallowed type or size before any upload with **Choose a JPEG, PNG, or
   WebP image under 5 MiB.** Native metadata may provide a local aspect ratio, but the
   client must not decide whether a WebP is animated or whether bytes are malformed; animated
   WebP and all other decode/animation/multipage decisions are server-owned.
3. A locally valid result appears as a preview card labelled **Ready to send** with its local
   aspect ratio. The User may tap **Remove image** before sending, and **Send image** is enabled.
   Removing the preview makes no network request and leaves no outbox item.
4. Tapping **Send image** makes one multipart message request and changes the local state to
   **Checking image…**. That state begins only after Send and remains until the server returns
   the canonical message. There is no mid-flight cancel affordance; leaving the screen may
   abandon only the local draft, not create a hidden outbox item.
5. On success, replace the local preview with the canonical image message and clear the
   draft. Render the server-provided dimensions/aspect ratio and a private signed URL. Do not
   show a local file URI as if it were sent.
6. On retryable outage (`NETWORK_ERROR`, timeout, 5xx/media service unavailable), keep the
   preview and exact draft/message ID, show **Image couldn't be sent. Check your connection and
   try again.**, and expose **Retry image**. Reuse `clientMessageId` so an interrupted request
   is safe to retry and cannot create a second message.
7. On a scanner/content rejection or permanent validation error, mark the draft rejected and
   show **This image can't be sent. Choose a different image.** Keep **Remove image** available
   so the User can dismiss the rejected preview or choose another image; do not offer a retry
   for a disallowed type, animated WebP, over-size file, inaccessible conversation, or
   moderation rejection. The animated-WebP result is determined by the server, even if the
   local picker metadata calls it `image/webp`.

The summary/list preview for an image is the literal text **Photo**. It never embeds the
private image URL, image bytes, or user-authored content in a notification preview.

## Server contract dependency (DS-97)

The server must expose an authenticated multipart message path that uses the private media
pipeline for both Event and Direct conversations. The following contract is the mobile target:

| Method | Path | Request | Response |
|---|---|---|---|
| `POST` | `/api/v1/ganaps/:ganapId/chat/messages` | Multipart `clientMessageId` and one `file`; authenticated readable/sending User | Canonical `ChatMessage` with `type: "IMAGE"` and `media` |
| `POST` | `/api/v1/direct/conversations/:conversationId/messages` | Multipart `clientMessageId` and one `file`; authenticated readable/sending User | Canonical `ChatMessage` with `type: "IMAGE"` and `media` |

The Direct route is consumed after DS-99 establishes canonical Direct conversations. Event
Chat must continue to use the Ganap-scoped route required by DS-95. Both message routes derive
the conversation from the path/context, verify the upload belongs to the current User and
authorized Business-only context, and enforce the same `clientMessageId` idempotency rule as
text. There is no separate client upload-intent or media-ID hand-off in v1.

The canonical message shape extends the existing response without removing text fields:

```typescript
{
  id: string;
  conversationId: string;
  senderId: string;
  senderUsername: string;
  senderDisplayPicture: string | null;
  content: string | null;
  type: 'IMAGE';
  sentAt: string;
  media: {
    id: string;
    url: string;
    mimeType: 'image/webp';
    bytes: number;
    width: number;
    height: number;
  };
}
```

The server stores media in a private bucket and issues short-lived signed URLs. It validates
MIME and file signatures, decodes dimensions, rejects animation (including animated WebP),
rejects anything above 5 MiB, runs the DS-94 media-safety check, and cleans up an orphaned
upload that never becomes a message. Scanner metadata and canonical hashes remain server-side
moderation fields and are not returned to mobile. Production upload and URL delivery are
HTTPS; the chat socket remains WSS. Do not introduce E2EE in this feature because server-side
media moderation and human reports must remain possible.

The global error envelope adds these typed codes (the client must branch on `errorCode`, not
message text):

| Code | Meaning | UI |
|---|---|---|
| `IMAGE_TYPE_NOT_ALLOWED` | Not JPEG/PNG/WebP | Permanent validation copy |
| `IMAGE_MALFORMED` | Decode failure, animation, or multipage image | Permanent validation copy |
| `IMAGE_INPUT_TOO_LARGE` | More than 5 MiB | Permanent validation copy |
| `IMAGE_PIXEL_LIMIT_EXCEEDED` / `IMAGE_CANONICAL_TOO_LARGE` | Canonical image exceeds server limits | Permanent validation copy |
| `CONTENT_BLOCKED` | Safety scanner rejected the image | Remove/choose another image |
| `MEDIA_SCANNER_UNAVAILABLE` | Retryable scanner/service failure | Keep draft; explicit retry |
| `MEDIA_CAPACITY_EXCEEDED` | Pre-buffer image pipeline is full; `Retry-After` is supplied | Keep draft, show **Images are busy. Try again in <seconds>.**, and disable explicit retry until the server delay elapses |
| `IMAGE_PERSISTENCE_FAILED` | Retryable storage/transaction failure | Keep draft; explicit retry |
| `UNAUTHORIZED` / `FORBIDDEN` | Conversation/Business-only access denied | Stop and show access state |
| `CLIENT_MESSAGE_ID_REUSED` | Retry key is bound to another message | Refetch and require a new draft |
| `NETWORK_ERROR` | Transport failure | Keep draft; explicit retry |

The server adds all routes and flag ownership to `docs/flags.md`. It does not widen the
existing public `uploadImage` contract for this feature; chat media has its own validation and
private-storage path.

## Three-layer client contract and cache/reconnect rules

1. Add a typed multipart image-send function to `src/api/endpoints/chat.ts` (or a narrowly
   named `chat-media.ts` module if the endpoint surface becomes too large). Use
   `axiosInstance` for the authenticated HTTP call, preserve multipart boundaries, and return
   the inner envelope value. The signed/private URL is treated as data, never as a new API
   base URL.
2. Add query/mutation wrappers under `src/hooks/queries/` and `src/hooks/mutations/` with
   explicit `UseMutationResult` types, one retry policy, and TSDoc. The upload-then-message
   sequence is one aggregate action with a stable `clientMessageId`.
3. Extend `useChat` from DS-95 so the composer owns a typed image draft state and exposes
   `pickImage`, `removeImage`, `sendImage`, `retryImage`, and progress/pending flags. The
   socket singleton remains the only realtime connection.

Do not optimistically insert an image message. When the canonical response arrives, patch the
active Event/Direct `messages` query and the conversation list summary with `type: IMAGE` and
preview **Photo**. Socket delivery of that canonical message is deduplicated by message ID.
If a reconnect happens after upload/message uncertainty, refetch the active cursor window;
the idempotency key prevents a duplicate message.

When the five-minute signed URL expires or an image load returns an expiry/authorization
failure, refetch the active message/history once; DS-97 regenerates a fresh signed URL on
message/history responses. Conversation summaries contain only `Photo`. Update the cached URL from that canonical
response. A second failure leaves the bubble in a retryable image-load state with **Retry
image**; it must not expose the private object key or signed URL in copy/logs. Blocked or
no-longer-authorized Users receive the same server filtering as text history.

## Accessibility and visual rules

- The attachment action is labelled **Add image**; preview removal is **Remove image**;
  sending is **Send image**; retry is **Retry image**. Expose busy/disabled states while
  checking/uploading. Do not use a camera icon to imply capture.
- The image bubble has content description **Photo sent by [username]** plus a description of
  its dimensions when available. It preserves the server aspect ratio within a bounded
  bubble, clips safely, and opens the authorized URL on tap. Report/long-press actions remain
  reachable for the whole bubble.
- Keep previews and composer above the keyboard with safe-area insets; use `Loading`,
  `ErrorView`, and `Empty` for foreground states. Respect large font scales, light/dark
  semantic tokens, and no hard-coded colors. No emoji or content preview appears outside the
  permitted reaction glyph exception documented in `docs/DESIGN.md`.

## Automated tests (write first)

- Picker tests cover one-image configuration, no video/camera/multiple selection, known MIME
  and 5 MiB prechecks, a WebP preview that remains eligible until the server validates it, and
  removal before send. Animated WebP is covered by the server-response path, not a client
  animation classifier.
- Endpoint tests pin multipart fields, Event/Direct message paths, image DTO, envelope
  unwrapping, private URL handling, idempotency keys, the public media projection (without
  scanner metadata), and every typed scanner/validation/retryable error.
- Mutation tests cover one-request ordering, no message after permanent scanner rejection,
  retry with the same `clientMessageId`, no SQLite/outbox call, duplicate-ID reconciliation,
  `MEDIA_CAPACITY_EXCEEDED` `Retry-After` countdown/gating, and explicit retry state.
- Renderer tests cover the Ready-to-send preview, Checking image… only after Send, canonical
  dimensions/aspect ratio, Photo list preview, one signed-URL refresh through a canonical
  message/history refetch, expired-URL retry state,
  reconnect/history rendering, moderation report on an image, and blocked-user filtering.
- Permission/config tests verify no new camera, microphone, or media-library permission and
  no new `NS*UsageDescription` entry beyond the reviewed picker purpose.
- Accessibility tests cover exact labels, busy states, keyboard/safe-area behavior, large font
  wrapping, and both themes.

## Android manual journeys

Run on a connected Android emulator with the display awake. Resolve its current serial with
`adb devices -l`; do not couple the journey to an AVD name or reassigned serial. Use
`android layout --device <device-serial> --pretty` as the primary assertion and screenshots
as secondary visual evidence. Use disposable fixture Users/Ganaps and a local image corpus;
never use the named SuperAdmin, Business, or User accounts.

The later CLI runner captures `android layout --device <device-serial> --pretty` before and after
each XML action, then uses element centers/bounds from the JSON with
`adb -s <device-serial> shell input tap <x> <y>`, slow scrolls with
`adb -s <device-serial> shell input swipe <x1> <y1> <x2> <y2> 500`, and focused-field input
with `adb -s <device-serial> shell input text`. For retryable failure, disable/restore
connectivity with `adb -s <device-serial> shell svc wifi disable` and
`adb -s <device-serial> shell svc wifi enable` outside the UI
action and record the commands. For the signed-URL refresh case, use a naturally expired URL
that was issued with the real 300-second lifetime; the isolated dev fixture may pre-mint and
hold that bearer until expiry, then replay it for the next image-load response. It must not
shorten the signer TTL or change the device/server clock. Capture a secondary image with
`android screen capture --device <device-serial> -o <evidence-path>.png` only for visual
review. Use the `ds95-event-sender` Event fixture (and the `ds99-friend-a` Direct fixture
when exercising the reusable renderer) plus the local image corpus from
`docs/superpowers/specs/2026-09-01-app-store-manual-qa-fixtures.md`.
Run the Wi-Fi disable command immediately before the retry-case send and restore connectivity
immediately after the failed-send assertion. Configure and restore the expired-URL fixture
outside the XML immediately before and after its URL-refresh assertion; record all setup
results in the run report.

```xml
<journey name="DS-98 chat images">
  <description>Verify library-only static image selection, validation, upload, rendering, and retry.</description>
  <actions>
    <action>Open the ds95-event-sender Event Chat and verify Add image is visible in the composer.</action>
    <action>Tap Add image and verify the existing library picker opens without a camera or microphone prompt.</action>
    <action>Select the valid-jpeg-under-5m.jpg fixture.</action>
    <action>Verify the preview is labelled Ready to send, Send image is enabled, and Remove image is available before Send image.</action>
    <action>Tap Send image and verify Checking image… begins only after the tap and remains until the server response.</action>
    <action>Verify the canonical Photo message renders with the correct aspect ratio and report action.</action>
    <action>Tap Add image and select the input-over-5m.jpg or unsupported-type.txt fixture.</action>
    <action>Verify the over-size or unsupported fixture is refused before upload with the validation copy.</action>
    <action>Tap Add image and select the animated-webp.webp fixture.</action>
    <action>Verify the animated WebP fixture is not rejected by a local animation classifier.</action>
    <action>Tap Send image and verify the candidate reaches the server and enters the Checking image… state.</action>
    <action>Verify the server returns IMAGE_MALFORMED and the permanent validation copy, with Remove image still available.</action>
    <action>Tap Add image and select the valid-jpeg-under-5m.jpg fixture.</action>
    <action>Tap Send image and verify Retry image keeps the preview after the transport failure.</action>
    <action>Tap Retry image once and verify one canonical Photo message appears.</action>
    <action>Verify that a stale image authorization response causes one canonical URL refresh without exposing a private object URL.</action>
  </actions>
</journey>
```

Record the layout JSON, file-validation result, fixture label, canonical message ID, and
permission diff. Run the network disable/restore and signed-URL expiry setup outside the XML
and record the exact fixture outcome. If the server scanner or private URL endpoint is
unavailable, mark the affected action blocked instead of treating a local preview as a sent
message.
