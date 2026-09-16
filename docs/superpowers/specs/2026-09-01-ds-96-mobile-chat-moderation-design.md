# DS-96 — Chat moderation UI: report and block

**Date:** 2026-09-01
**Repository:** `ganapps-mobile`
**Branch:** `feat/ds-96-mobile-chat-moderation` (from `feat/ds-95-mobile-chat-core`)
**Depends on:** DS-95 mobile Event Chat and server DS-94 moderation contract
**Blocks:** `feat/ds-98-mobile-chat-images`
**Status:** Implementation-ready specification

The implementation PR must name the server DS-94 contract/commit in its description. The
server is the authority for filtering, report ownership, and block enforcement. A client-only
filter or a hidden settings-only report control does not satisfy this feature or Apple's
Guideline 1.2.

## Outcome and scope

From any text or media message, a User can reach **Report** through one long-press interaction,
choose a reason, confirm, and receive clear receipt copy. From a message or a User profile,
the User can block the author after an explicit confirmation. A blocked author's messages are
removed from the visible cache immediately and are excluded from later history/live events.
Settings exposes a reversible **Blocked users** list with an unblock action.

This UI applies to Event Chat and, once DS-99 lands, Direct Chat. The affordance is on the
message surface regardless of message type, including image messages and the 30-day reportable
unsent tombstone defined by DS-99. Event and direct reports are routed to different server
moderation owners; the mobile UI does not reveal internal moderation queues.

## Existing mobile anchors

- DS-95 owns the typed message query/mutation layers and the one shared Socket.IO connection.
  DS-96 composes on those layers and must not create a second socket or a second message cache.
- `Routes.app.chat` remains the internal `(chat)` tab root; the visible tab becomes Friends in
  DS-99. A profile or settings route must be added to `src/constants/routes.ts` in object form
  if it does not already exist; navigation never uses a string literal.
- Use the existing `Button` destructive variant for block confirmation, `Card`, `Text`,
  `IconButton`, `Loading`, `ErrorView`, and `Empty`. Reasons may use the existing input/form
  composition, with semantic tokens from `docs/DESIGN.md` in light and dark themes.

## User experience

### Report

Long-pressing a message opens an action sheet containing **Report message**. This action must
be discoverable on the message itself, not only on Settings or a profile screen. The sheet
shows a required reason picker with these exact labels:

- Harassment or bullying
- Hate or hateful conduct
- Sexual content
- Threats or violence
- Spam or scam
- Something else

The client maps those labels to the server enum values `HARASSMENT`, `HATE`,
`SEXUAL_CONTENT`, `VIOLENCE_OR_THREATS`, `SPAM`, and `OTHER`, respectively. It sends only the
enum plus optional details for `OTHER`; visible copy is never used as the protocol value.

The User must choose one reason before **Continue** is enabled. A second confirmation states
**Report this message?** and explains that the report is sent to the appropriate moderation
team for review. The final action is **Submit report**. On success show **Report received.
We'll review it.** and close the sheet. A repeated report for the same target returns the
existing report receipt rather than creating a duplicate; the UI shows the same neutral
success copy.

The report payload includes the target type/ID, reason enum, and optional free-text detail
(maximum 1,000 Unicode characters) only for **Something else**. The server derives the
message's conversation and Event/Direct scope from the target; the client must not send a
caller-supplied `conversationId` as an authority boundary. It never sends a locally cropped
screenshot or the User's access token as message content. The server captures the immutable
evidence needed for a human response, including a media reference when the target is an image.

### Block

Long-pressing another User's message includes **Block user**. A profile action includes
**Block user**. **Report user** is shown only when the profile was opened from an authorized
Event or Direct conversation in which the target is eligible under DS-94; no message selection
is required, but the conversation context must exist. A standalone Friends profile with no
authorized conversation does not show **Report user** until the server provides an explicit
profile/platform report scope. This keeps the no-message profile action useful without
issuing a `USER` report the server cannot authorize. **Report user** uses the same reason and
confirmation flow with a `USER` target. A block confirmation sheet says **Block this user?**
and explains that their messages will disappear from this User's visible Event and Direct Chat
history, new direct requests will be prevented, and the block can be undone in Settings. It
also states that blocking removes any Friendship for both Users and that unblocking will not
restore the Friendship or a pending request. The
Event and Direct conversation rows remain subject to the directional server response;
blocking is not a local conversation delete. The final destructive action is **Block user**.

After the server accepts the block, filter that user's messages from every loaded page and
stop rendering their live socket messages. Preserve the Event Chat conversation row: it is a
Ganap-level conversation and other Attendees may still have visible messages. Preserve the
Direct conversation row as well; blocking never evicts an entire Event or Direct row. Reconcile
each row's latest visible-message preview, unread count, and capability from the authoritative
post-`204` refetch, and patch loaded history immediately to the messages this User may still see. If the
server marks a Direct session unreadable, show that read/access state on the retained row and
close a focused thread only after the server explicitly revokes the current User's read
access. Do not wait for a refetch to make the message-level safety effect visible. A server
rejection rolls back the optimistic message filter, refetches the affected queries, and shows
the typed error. The server remains authoritative if another device blocks/unblocks the User
or if an old socket event races with the mutation.

Settings → **Blocked users** lists safe profile summaries and an **Unblock** action. Unblock
requires no typed confirmation, but its result is explicit; after success, the User may see
new Event messages according to server visibility, but Direct messaging remains unavailable
until a new Friend Request is accepted. Existing
history is not silently reconstructed into the current thread; refetch on the next open.

## Server contract dependency (DS-94)

The server must add the following authenticated routes to `docs/flags.md` under the moderation
flag (and keep them disabled when the related chat feature is disabled):

| Method | Path | Request | Response |
|---|---|---|---|
| `POST` | `/api/v1/moderation/reports` | Message: `{ target: { type: "MESSAGE", id }, reason, details? }`; User: `{ target: { type: "USER", id }, contextConversationId, reason, details? }` | `201` with `{ id, status: "OPEN", priority, dueAt, createdAt }` |
| `GET` | `/api/v1/me/blocks?cursor=&limit=` | none; cursor page, limit 1–50 | `{ items: [{ userId, username, displayName, displayPicture, blockedAt }], nextCursor }` |
| `POST` | `/api/v1/users/:userId/block` | no target body; server derives the target User from the path and current auth | `204` |
| `DELETE` | `/api/v1/users/:userId/block` | no body | `204` |

`target.type: "MESSAGE"` is valid for `TEXT`, `IMAGE`, and an unsent tombstone while the
server's 30-day evidence-retention window is open. `target.type: "USER"` is used by a profile
report action only when that profile was reached from an authorized Event/Direct conversation;
the profile may be reported without selecting a message. The mobile navigation may retain the
origin conversation for presentation gating and sends its validated ID as
`contextConversationId`. That value is a locator, never authority: the server verifies both
Users against the conversation and derives Event/Direct/Ganap/Business scope. A
standalone Friends profile must hide **Report user** until DS-94 adds a supported
profile/platform scope. The server derives the message's conversation, Ganap/Direct scope,
and target User from the target ID; Block paths likewise derive the current User from the
bearer token and the blocked User from `:userId`. The server rejects self-targets, malformed
reasons, unknown messages, and reports outside the evidence window with typed global errors.

The required error codes are:

| Code | Client treatment |
|---|---|
| `INVALID_REPORT_TARGET` | Close with **This message is no longer available.** or keep the form for a corrected target |
| `200` with the existing report receipt | Treat as an idempotent receipt; do not create a duplicate |
| `REPORT_SCOPE_FORBIDDEN` | Do not disclose report scope; preserve the visible message |
| `SOCIAL_TARGET_UNAVAILABLE` | Reject and keep the User unblocked without revealing why the target is unavailable |
| `REPORT_NOT_FOUND` | Reconcile the report receipt; do not expose internal scope |
| `SOCIAL_STATE_CHANGED` | Refetch the block/list state and offer explicit retry |
| `REPORT_ALREADY_CLOSED` | Report cannot be changed; retain the message |
| `FORBIDDEN` / `UNAUTHORIZED` | Preserve the existing auth/access handling |
| `TOO_MANY_REQUESTS` / `NETWORK_ERROR` / `INTERNAL_SERVER_ERROR` | Keep the action available for explicit retry |

Reports are visible to a named human owner: Event reports are scoped to the Business that
owns the Ganap and direct-chat reports are visible to SuperAdmin. The server stores report
status, timestamps, reporter, target, and human-action metadata; mobile never exposes an
internal status beyond **Report received**. DS-94 also adds server-side objectionable-content
filtering before text is persisted and a media-safety decision before an image message is
published. Client heuristics are advisory only.

Block semantics are directional for visibility: the blocker cannot receive the blocked User's
messages in REST history or the live socket stream, and the blocked User cannot start a new
direct request to the blocker. Other members of an Event Chat retain their own server-granted
view. The server applies this rule on every request and socket emission, so a cache filter is
only an immediate UX safeguard. Block state is never inferred from the existing Friend
`BLOCKED` request status without the moderation endpoint.

All HTTP calls use HTTPS and the existing bearer interceptor; the `/chat` socket uses WSS and
the shared short-lived ticket. Do not add E2EE in this feature: the required server-side
filtering and human report review require server-readable content. Transport encryption and
private media URLs protect data in transit and at rest without making moderation impossible.

The shared DS-95 socket registers these moderation handlers exactly once:

- `chat:message:hidden` with `{ conversationId, messageId }` removes that message from every
  loaded page, drops any in-memory media bearer URL for it, and invalidates the affected
  history plus conversation summary so the server supplies the next visible preview and unread
  count. A focused thread remains open unless the server separately revokes access.
- `chat:access:revoked` with `{ conversationId, ganapId }` leaves the room, cancels and removes
  that Event Chat's message/session queries and in-memory media URLs, invalidates the Event Hub,
  Registration, and conversation summaries, and navigates a focused thread back to the Event
  Hub with **You no longer have access to this chat.** It never retries room join from stale
  cache state.

Both handlers are idempotent, ignore unrelated conversation IDs, and refetch server authority
after cache eviction. Reconnect registers no duplicate listeners and cannot restore content
removed by either event.

## Three-layer client contract and cache behavior

Add typed endpoint functions in `src/api/endpoints/moderation.ts`, query/mutation wrappers in
`src/hooks/queries/` and `src/hooks/mutations/`, and an aggregate moderation surface only if
the screen needs to coordinate more than one mutation. Every export has TSDoc and explicit
types; every endpoint uses `axiosInstance` and returns the inner envelope payload.

Use query keys such as:

```typescript
moderationQueryKeys = {
  all: ['moderation'] as const,
  blocks: () => [...moderationQueryKeys.all, 'blocks'] as const,
};
```

The server deduplicates an active report by reporter and target, so an explicit retry after a
timeout returns the existing receipt instead of creating another human-review record. Mobile
does not invent an undocumented idempotency header. Report mutations do not enqueue SQLite
work. Block/unblock mutation behavior is:

1. Snapshot affected `eventMessages`, `directMessages`, and conversation-list queries.
2. Optimistically filter only the blocked sender's rows and reconcile the latest visible
   message/read-only capability for each conversation; preserve both Event and Direct rows and
   never delete an entire conversation row/history solely because a block was requested.
3. Call the server. On success, invalidate the affected conversation/list keys and preserve
   the filtered result. On a typed failure, restore the snapshot and refetch the server
   authority; on a transport failure, restore the snapshot but leave an explicit retry state.
4. Socket message handlers consult the latest blocked-user set before patching any query. A
   reconnect always refetches `/me/blocks` before joining rooms.

Report success only invalidates/updates the report receipt state; it must not remove a message
unless the server's subsequent history omits it. A report is not a local delete.

## Accessibility, keyboard, and visual rules

- Long-pressable messages expose an accessibility action or an adjacent labelled **More
  actions** button so a screen-reader User is not forced to discover a gesture. Its label is
  **Message actions for [sender]**.
- Reason rows have exact spoken labels matching the visible labels. The confirmation and
  destructive buttons expose their role, disabled/busy state, and a hint describing the
  consequence. The success receipt is announced as a live status, not an unlabelled toast.
- Settings has an accessible heading **Blocked users**, safe profile labels, and an
  **Unblock user [username]** action. No email, exact location, or private provider field is
  shown in a profile summary.
- Sheets and lists use safe-area insets, keyboard-aware scrolling for the optional detail
  field, and the existing semantic tokens/primitives in light and dark themes. Copy wraps at
  large font scales; no action depends on color alone. No emoji is used in labels or copy.

## Automated tests (write first)

- Endpoint tests pin report, block-list, block, and unblock methods/paths/bodies, envelope
  unwrapping, duplicate-receipt behavior, and each typed server error.
- Report form tests cover message long-press and media-message discoverability, authorized
  profile **Report user** with no message selection, hiding the action for a standalone profile
  with no report context, every reason, required validation, confirmation, success receipt,
  duplicate receipt, expired target, and explicit retry after a transport failure.
- Block mutation tests cover immediate filtering of only the blocked sender's messages,
  preservation of Event conversation rows, Direct summary/session reconciliation, socket
  suppression, rollback on server failure, idempotent already-blocked/unblocked responses,
  invalidation, and no outbox write.
- Settings tests cover blocked-user loading/error/empty states and reversible unblock.
- Socket integration tests cover a raced message while blocking, reconnect block-list refresh,
  server-authoritative reappearance only after unblock/refetch, exact
  `chat:message:hidden` removal/invalidation, and `chat:access:revoked` room teardown,
  navigation, and media-cache eviction without duplicate reconnect listeners.
- Accessibility tests cover the labelled alternative to long press, confirmation actions,
  status announcement, keyboard avoidance, default/enlarged font scales, and both themes.

## Android manual journeys

Run on a connected Android emulator with the display awake. Resolve its current serial with
`adb devices -l`; do not couple the journey to an AVD name or reassigned serial. Use
`android layout --device <device-serial> --pretty` as the primary check and screenshots
only for secondary visual review. Capture them with
`android screen capture --device <device-serial> -o <evidence-path>.png`. Use the
`ds96-moderation-viewer`, `ds96-message-author`, and `ds96-profile-target` fixture roles from
`docs/superpowers/specs/2026-09-01-app-store-manual-qa-fixtures.md`; never use the named
SuperAdmin, Business, or User accounts.

The later CLI runner captures `android layout --device <device-serial> --pretty` before and after
each XML action, then uses element centers/bounds from the JSON with
`adb -s <device-serial> shell input tap <x> <y>`, slow scrolls with
`adb -s <device-serial> shell input swipe <x1> <y1> <x2> <y2> 500`, and focused-field input
with `adb -s <device-serial> shell input text`. Capture a secondary image with
`android screen capture --device <device-serial> -o <evidence-path>.png` only for visual
review; layout JSON is the primary record.

```xml
<journey name="DS-96 chat moderation">
  <description>Verify report discoverability, block filtering, and reversible unblock.</description>
  <actions>
    <action>Open the disposable Event Chat for ds96-moderation-viewer containing a message from ds96-message-author.</action>
    <action>Long-press the message and verify that Report message is visible from the message surface.</action>
    <action>Choose Harassment or bullying.</action>
    <action>Continue and verify the report confirmation names human review.</action>
    <action>Submit report and verify that Report received. We'll review it. is announced.</action>
    <action>Open ds96-profile-target's profile from the authorized conversation and verify Report user is available without selecting a message.</action>
    <action>Submit the profile report and verify the same neutral receipt without exposing an internal moderation scope.</action>
    <action>Long-press the same message and choose Block user.</action>
    <action>Verify the confirmation states that blocking removes Friendship and that unblocking will not restore it or a pending request.</action>
    <action>Confirm Block user.</action>
    <action>Verify that the blocked User's messages disappear immediately and no new live message from that User is rendered.</action>
    <action>Return to Chats and verify the Event row remains with its latest visible preview and unread state.</action>
    <action>Open the existing Direct fixture for ds96-moderation-viewer, block ds96-message-author, and verify the Direct row remains while its preview/history/capability is patched to the directional server result.</action>
    <action>Open Settings and verify that Blocked users contains the fixture.</action>
    <action>Tap Unblock user for the fixture and verify that the block list updates.</action>
    <action>Verify that a server-authorized Event history refresh can show new messages again, while Direct remains not-friends/read-only and no Friendship or pending request is restored.</action>
  </actions>
</journey>
```

Record layout JSON, fixture labels, the originating conversation context for the profile
report, both report receipt IDs (MESSAGE and USER), and the block-list response. If
report/block endpoints are unavailable, mark the journey blocked rather than replacing server
behavior with a local mock.
