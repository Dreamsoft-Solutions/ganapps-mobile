# DS-99 — Friends hub, Direct Chat, and engagement

**Date:** 2026-09-01
**Repository:** `ganapps-mobile`
**Branches:** `feat/ds-99-mobile-friends` → `feat/ds-99-mobile-direct-chat` → `feat/ds-99-mobile-engagement`
**Base topology:** `dev` → DS-95 Event Chat → DS-96 moderation → DS-98 images → this three-branch sequence
**Depends on:** Server DS-94 moderation, DS-97 images, and server DS-99 social/direct/engagement contracts
**Status:** Implementation-ready specification

Each mobile PR must list its cross-repository server dependency/commit in the PR description.
The branch sequence is locked because Direct Chat reuses the Friends contract and engagement
reuses both Direct and image/message primitives:

`feat/ds-99-mobile-friends` → `feat/ds-99-mobile-direct-chat` → `feat/ds-99-mobile-engagement`.

## Product outcome

The existing four-tab shell remains Map, My Events, Friends, and Profile. The visible tab
formerly labelled **Chat** is renamed **Friends**; keep the internal Expo Router `(chat)`
route group and its `Routes.app.chat` entry so existing route ownership stays type-checked.
The Friends hub provides:

- top-level **Add Friend** and **My Code** actions;
- a stable-random carousel of currently active friends;
- **Chats**, **Friends**, and **Requests** segments, with Requests split into **Incoming**
  and **Outgoing**;
- server-ordered chat summaries that mix Event Chat and Direct Chat, show unread counts, and
  use **Photo** as the image preview; and
- safe friend profiles, requests, unfriend/block actions, presence, and optional Going data.

Friend acceptance never creates an empty Direct conversation. Direct Chat is created lazily
by the first successful send and uses one canonical conversation per accepted friend pair.
Event Chat remains a Ganap-scoped group conversation and is never merged with Announcements.

The shared synthetic fixture roles, two-device mapping, push observation window, and
out-of-band setup contract are defined in
`docs/superpowers/specs/2026-09-01-app-store-manual-qa-fixtures.md`.

## Existing mobile anchors

- `src/app/(app)/_layout.tsx` renders exactly four `Tabs.Screen` entries. Keep this count;
  change only the visible `AppTabBar` label from `Chat` to `Friends` in the final Friends PR.
- `Routes.app.chat` points at `/(app)/(chat)/chat`. Add typed object-form route entries for
  any thread/profile/settings screen and navigate through `Routes`, never a route string.
- DS-95 owns the Event Chat endpoint/query/mutation/aggregate layers and the process-wide
  Socket.IO singleton. Direct Chat and Friends must extend the same `useChat`/socket/cache
  architecture rather than opening another connection.
- DS-96 owns message long-press report/block affordances; DS-98 owns the image picker and
  canonical image bubble. Friends/Direct rows consume their outputs and do not duplicate them.
- Use `Avatar`, `Card`, `Button`, `IconButton`, `Text`, `Chip`, `Loading`, `ErrorView`, and
  `Empty` with the semantic tokens in `docs/DESIGN.md`. `useSafeAreaInsets`, keyboard-safe
  scrolling, and large-font layout are required on every new screen.

## Friends hub behavior

### Header and active carousel

The hub header has two visible actions: **Add Friend** and **My Code**. My Code lazily loads
the current code, offers a copy/share action, and can regenerate it after a deliberate
confirmation. Add Friend accepts a Friend Code and previews only the server's safe target
summary before the User sends a request.

The active carousel is informational, not a presence chat room. It renders only accepted,
unblocked friends returned by the server's presence endpoint. The server issues an opaque
screen-session seed and returns active friends in an order that is stable only while that
Friends screen session remains focused. The client reuses the seed for that session and does
not randomise on every render; a later focus may receive another order.
If no friend is active, show **No friends are active right now.** without guessing from a
cached timestamp. There is no presence push, exact last-seen time, location, or one-socket-per-
friend connection.

### Segments and lists

- **Chats** renders the server's mixed Event/Direct conversation summary feed. Rows show the
  event title or safe friend name, `lastMessage.preview`, timestamp, and unread count. The
  preview is text for a text message and the literal **Photo** for an image. An unsent message
  preview is **Message unsent**. Rows are ordered by the server's `updatedAt DESC, id DESC`;
  the client does not sort or derive unread counts. A directional block patches the latest
  visible preview, unread count, and capability in place; it never removes the Event or Direct
  row as a local side effect.
- **Friends** renders cursor-paginated accepted, unblocked safe profiles. A profile may show
  display name, username, avatar, bio, interests, permitted active status, and permitted
  Going summaries; it never shows email, provider identifiers, check-in detail, forms,
  membership role, moderation state, or exact location. Profile actions follow DS-96: a
  standalone profile may offer **Block user**, but **Report user** appears only when the
  profile was opened from an authorized Event/Direct conversation context.
- **Requests** has an explicit nested segmented control **Incoming** / **Outgoing**. Incoming
  rows provide Accept and Reject; outgoing rows provide Revoke. Pending requests do not expire
  automatically. Reject and Revoke show the server's exact `retryAt` when the User later tries
  to request that person again.

List screens use `Loading`, `ErrorView` with retry, and `Empty`. They fetch only summaries.
Opening an Event or Direct row resolves its session and then fetches cursor history. The hub
never preloads every message page or image bytes.

### Friend Code and requests

Codes are displayed in grouped text for readability but are exactly 12 uppercase characters
from the case-insensitive Crockford alphabet `0123456789ABCDEFGHJKMNPQRSTVWXYZ`. Input trims,
uppercases, and removes spaces/hyphens before submission. A regenerated code invalidates the
old code immediately. Code values identify a target; they are not credentials.

The server's rate-limit response includes an ISO `retryAt`. The UI must show the exact local
date/time, for example **Try again after Sep 2, 2026 at 2:30 PM (Asia/Manila).** It must never
replace this with a generic “try later” when `retryAt` is present. This applies to code
regeneration and request cooldowns.

When an incoming request is accepted, invalidate Friends, Requests, Chats, and the safe
profile queries. When it is rejected/revoked, retain the attempt outcome and cooldown; do not
create a chat or send a push. If the two Users request each other while both requests are
pending, the server auto-accepts the pair and returns the accepted outcome.

## Server contract dependency (server DS-99)

All routes below require an authenticated active User and `feature_friends`, unless another
feature flag is stated. The server derives authorization from the bearer token, canonical
friend pair, active block rows, and current settings; the mobile client only presents the
returned capability.

### Code, profiles, and requests

| Method | Path | Request | Response |
|---|---|---|---|
| `GET` | `/api/v1/friends/code` | none | `{ code, issuedAt }` |
| `POST` | `/api/v1/friends/code/regenerate` | none | `{ code, issuedAt }` |
| `GET` | `/api/v1/friends/lookup?code=` | normalized code | `{ userId, username, displayName, displayPicture }` |
| `POST` | `/api/v1/friends/requests` | `{ friendCode }` | `201` `{ attemptId, pairId, status, requesterUserId, targetUserId, createdAt, retryAt }` |
| `GET` | `/api/v1/friends/requests?direction=incoming\|outgoing&cursor=&limit=` | cursor page | `{ items, nextCursor }` |
| `POST` | `/api/v1/friends/requests/:attemptId/accept` | none | Accepted attempt |
| `POST` | `/api/v1/friends/requests/:attemptId/reject` | none | `{ status: "REJECTED", retryAt }` |
| `DELETE` | `/api/v1/friends/requests/:attemptId` | outgoing only | `{ status: "REVOKED", retryAt }` |
| `GET` | `/api/v1/friends?cursor=&limit=` | Cursor page | Safe accepted-friend summaries in stable canonical order |
| `DELETE` | `/api/v1/friends/:userId` | accepted pair | `204`; Direct history remains |
| `GET` | `/api/v1/friends/:userId/profile` | relationship-scoped | Safe profile or stable not-found/forbidden |

The server uses one canonical unordered `FriendshipPair` and append-only request attempts.
An accepted pair has one friendship; a later request cannot create a duplicate. A block
deactivates the directional moderation state, ends the friendship, closes pending attempts,
and never restores either on unblock. Unfriend silently ends friendship, sends no push, and
does not delete the Direct conversation/history; Direct mutations remain unavailable until
the pair is accepted again, while retained history remains server-authorized read-only.

Stable social errors include `FRIEND_CODE_INVALID`, `FRIEND_CODE_NOT_FOUND`,
`FRIEND_CODE_RATE_LIMITED`, `SOCIAL_TARGET_UNAVAILABLE`, `ALREADY_FRIENDS`,
`FRIEND_REQUEST_COOLDOWN` (with `retryAt`), `FRIEND_REQUEST_NOT_FOUND`,
`FRIEND_REQUEST_FORBIDDEN`, and generic access errors that never identify a block. Branch on
`errorCode`; do not inspect message strings or infer whether a code was deleted, suspended,
blocked, or replaced.

### Presence, Going, and settings

| Method | Path | Request | Response |
|---|---|---|---|
| `POST` | `/api/v1/presence/heartbeat` | `{ deviceId }` | `204` |
| `GET` | `/api/v1/friends/presence?screenSession=&limit=` | Omit `screenSession` on a new focus; one bounded sample, limit 1–20 | `{ items, screenSession }` active accepted-friend summaries |
| `GET` | `/api/v1/friends/going?cursor=&limit=` | Cursor page, limit 1–50 | Safe friend + upcoming/ongoing Ganap summaries |
| `GET` | `/api/v1/friends/settings` | none | `{ presenceVisibleToFriends, goingVisibleToFriends }` |
| `PATCH` | `/api/v1/friends/settings` | either boolean setting | Updated settings |

Both visibility settings default to `true` for a new User. Presence is active when any known
device heartbeat is newer than 90 seconds; mobile sends a heartbeat every 30 seconds while
authenticated and stops on logout/deletion. Presence is one bounded carousel sample, not a
paginated friend inventory. On Friends-hub focus, the client makes one request, omits
`screenSession`, and stores the returned opaque session only to keep an explicit same-session
refresh stable; it never requests a next page or invents a cursor/offset. The server filters
accepted/unblocked friends and settings before returning presence. Going includes only
published future or ongoing Ganaps, returns `status: "GOING"`, and never distinguishes
`REGISTERED` from `ATTENDED` or exposes check-in state. A User can turn either setting off
globally; there is no per-Ganap override.

For Friends, profile, presence, and Going privacy, an active directional block is symmetric:
both Users disappear from each other's accepted-friend lists, presence, and Going results, and
profile lookup returns the same generic unavailable result in either direction. Chat message
visibility remains directional under DS-94, so the blocker loses the blocked sender's messages
while other Event Chat participants retain their own server-granted view. Unblock never
restores friendship or silently recreates a Direct conversation.

The client invalidates presence/Going on Friends focus in bounded batches and after a settings
mutation. It does not poll continuously, cache exact last-seen values, or fan out presence
events over the chat socket.

## Direct Chat lifecycle and server contract

Direct routes require `feature_direct_chat`, `feature_friends`, and
`feature_chat_moderation`; image sends additionally require `feature_chat_images`. New requests,
sends, reactions, and read advances require a currently accepted, unblocked pair. Existing
conversation summaries/history remain server-authorized according to directional block or
unfriend visibility and may be read-only; a blocked sender's messages are filtered without
deleting the conversation row. A Direct conversation is not created on acceptance. The first
successful send atomically upserts the canonical Direct conversation, its two participants,
and the Message. A retry or a later friendship reuses it.

An accepted friend's safe profile exposes **Message friend** as the lazy Direct entry point.
Opening that composer resolves the accepted pair but creates no conversation row or history;
the first successful send uses the friend-user route and creates the canonical row atomically.
Later opens use the conversation route returned by the server. The client must not fabricate an
empty Direct row on profile open or friendship acceptance.

| Method | Path | Request | Response |
|---|---|---|---|
| `GET` | `/api/v1/chat/conversations?type=ALL&cursor=&limit=` | Mixed Event/Direct summary cursor | `{ items, nextCursor }` |
| `POST` | `/api/v1/friends/:friendUserId/direct/messages` | text JSON or DS-97 multipart image | Canonical message; lazily creates conversation |
| `GET` | `/api/v1/direct/conversations/:conversationId/messages?cursor=&limit=` | cursor page | Newest-first message pages |
| `POST` | `/api/v1/direct/conversations/:conversationId/messages` | text JSON or DS-97 multipart image | Canonical message |
| `POST` | `/api/v1/direct/conversations/:conversationId/read` | `{ throughMessageId }` | `{ conversationId, throughMessageId, seenAt, readCount }` |

The unified summary response is server-owned and ordered across Event and Direct rows by
`updatedAt DESC, id DESC`. Direct rows use this shape; Event rows retain DS-95's Event shape:

```typescript
{
  type: 'DIRECT';
  conversationId: string;
  friend: { userId: string; username: string; displayName: string; displayPicture: string | null };
  lastMessage: { id: string; type: 'TEXT' | 'IMAGE' | 'UNSENT'; preview: string; sentAt: string } | null;
  unreadCount: number;
  latestOutgoingSeenAt: string | null;
  canRead: boolean;
  canSend: boolean;
  updatedAt: string;
}
```

Every `type=ALL` row is a `type: 'EVENT' | 'DIRECT'` discriminated DTO with
server-owned `canRead` and `canSend` capabilities. Mobile branches on that discriminant and
never infers send/read authority from friendship cache state.

History is fetched only when a row opens and uses the same opaque cursor convention as Event
Chat. Text uses `{ clientMessageId, content }`; image uses DS-97's one-file multipart
contract and returns a canonical `IMAGE` message with `content: null` and private signed
media. The first Direct send may use the friend-user route; once a conversation exists, the
conversation route is canonical.

Unfriend preserves read-only history but denies Direct send while not friends. A directional
block filters the blocked sender's messages from this User's history/live stream, while the
canonical Direct row and the User's own/otherwise visible history remain patchable according
to the server response. The client does not fabricate a new conversation after re-friending;
it asks the server for the canonical conversation/session.

### Mandatory Direct Seen behavior

Seen is a server monotonic cursor, not a client toggle. The client may call the read endpoint
only when the Direct thread is foregrounded and the target message is present in the loaded
list. It advances to the newest loaded message, and never advances because a list row was
prefetched, a background refetch completed, or the app merely received a push. Any device may
advance the same server cursor. The sender displays **Seen** only for the latest outgoing
message and only after the committed `seenAt` response or corresponding socket event; older
outgoing messages do not each receive a label. A pending read shows a transient spinner, and a
failed read is transient with retry on the next foreground load. There is no user setting to
disable Seen.

Event Chat continues to mark its read cursor for unread counts but has no Seen UI at all.

## Shared Socket.IO lifecycle and cache rules

Event and Direct Chat share one `/chat` Socket.IO client, websocket transport, and short-lived
ticket from `POST /api/v1/chat/socket-ticket`. The singleton exposes one connection state and
listener registry keyed by conversation ID. Direct events extend the existing namespace:

| Direction | Event | Payload |
|---|---|---|
| client → server | `chat:direct:join` | `{ conversationId }` |
| client → server | `chat:direct:leave` | `{ conversationId }` |
| client → server | `chat:direct:focus` | `{ conversationId, focused: boolean }` |
| server → clients | `chat:message:new` | Canonical message plus `conversationType: "DIRECT"` |
| server → clients | `chat:message:read` | `{ conversationId, userId, throughMessageId, seenAt }` |
| server → clients | `chat:message:reaction` | `{ conversationId, messageId, counts, myReaction }` |
| server → clients | `chat:message:unsent` | `{ conversationId, messageId, type, unsentAt }` |
| server → origin socket | `chat:error` | `{ errorCode, message }` |

REST remains the mobile path for history, send, and read. The socket is for room membership,
live messages, read/reaction/unsent events, and focus presence. It re-authenticates with a
fresh ticket after expiry, rejoins still-focused authorized rooms after reconnect, and
refetches the active cursor window. It never carries bearer tokens, permanent media URLs, or
notification previews.

Canonical REST responses and socket events patch the same TanStack Query keys. Deduplicate by
message ID, merge by `(sentAt, id)`, and invalidate summaries if an event arrives for an
unloaded page. Reconnect always refetches server summaries plus the active message window;
socket delivery is not treated as durable history.

## Engagement: message reactions

Message reactions apply to text and image messages in both Event and Direct Chat. They do not
apply to Announcements. The wire enum is exactly:

`HEART` → **❤️** · `LAUGH` → **😂** · `THUMBS_UP` → **👍** · `SAD` → **😢** · `ANGRY` → **😡**

These are the only system-native emoji allowed by the narrow exception in `docs/DESIGN.md`;
they are reaction glyphs, never general copy or icons. Each Message has at most one reaction
per User. The UI calls idempotent `DELETE` when the selected value is tapped, so that gesture
removes the reaction. Tapping another value calls idempotent `PUT` and replaces the prior
value; repeating the same `PUT` never toggles server state.

| Method | Path | Request | Response |
|---|---|---|---|
| `PUT` | `/api/v1/conversations/:conversationId/messages/:messageId/reaction` | `{ reaction: "HEART" \| "LAUGH" \| "THUMBS_UP" \| "SAD" \| "ANGRY" }` | `{ messageId, counts, myReaction }` |
| `DELETE` | `/api/v1/conversations/:conversationId/messages/:messageId/reaction` | none; idempotent remove | `{ messageId, counts, myReaction: null }` |
| `PUT` | `/api/v1/ganaps/:ganapId/announcements/:announcementId/reaction` | `{ reaction: ... }` acknowledgement | Aggregate + `myReaction` |
| `DELETE` | `/api/v1/ganaps/:ganapId/announcements/:announcementId/reaction` | eligible attendee only | Aggregate + `myReaction: null` |
| `GET` | `/api/v1/ganaps/:ganapId/announcements/:announcementId/reactions` | eligible attendee | Aggregate + `myReaction` |

The server's Message reaction response contains counts for all five enum values and the
caller's value. Event and Direct mobile responses do not include reactor identities.
No reaction emits a push. If a User leaves or is evicted, historical reactions remain in
counts but that User cannot mutate them; a current access check decides whether the Event
reaction surface is available.

Accessibility labels are exact and word-based:

| Glyph | Unselected label | Selected label |
|---|---|---|
| ❤️ | `React with heart` | `Remove heart reaction` |
| 😂 | `React with laughing face` | `Remove laughing face reaction` |
| 👍 | `React with thumbs up` | `Remove thumbs up reaction` |
| 😢 | `React with sad face` | `Remove sad face reaction` |
| 😡 | `React with angry face` | `Remove angry face reaction` |

The glyph itself is decorative to assistive technology; the exact labels above and selected
state are spoken. The reaction picker is reachable by message long press and by a labelled
button for keyboard/screen-reader Users.

## Engagement: Announcement acknowledgements

Announcement reactions are a separate acknowledgement model, never Event Chat messages. Only
current `REGISTERED` or `ATTENDED` Attendees can add, replace, or remove an acknowledgement.
Mobile participants receive aggregate counts and their own `myReaction`; they never receive
other attendee names. The owning Business `OWNER`/`ADMIN` identity view is a Ganapps Web
companion contract and is not a mobile screen. No acknowledgement sends a push.

Historical acknowledgement rows remain after a User leaves or is evicted. The former Attendee
cannot mutate the row; authorized organizer review may mark it as former. Mobile must not
invent identity data from counts or expose names after access is lost.

## Engagement: Unsend

Long-pressing the current User's own text or image within 15 minutes opens **Unsend**. The
second confirmation is labelled **Unsend for everyone** and states that the message will be
replaced for all readers. The server, not the client clock, enforces ownership, type, and the
15-minute window:

`DELETE /api/v1/conversations/:conversationId/messages/:messageId`

It returns and broadcasts an `UNSENT` tombstone. History shows **Message unsent**, with no
original text, image, signed URL, or reactions. There is no delete-for-me, edit, or typing
indicator/event. An unsent target remains reportable by a recipient for 30 days; DS-96's report
action stays available on the tombstone and the server retains moderation evidence only for
that policy window. Event and Direct messages both follow this rule; Announcements cannot be
unsent by a mobile User.

Stable server errors are `MESSAGE_ACCESS_FORBIDDEN`, `UNSEND_WINDOW_EXPIRED`,
`REACTION_NOT_ALLOWED`, `ANNOUNCEMENT_ACK_NOT_ALLOWED`,
`DIRECT_CONVERSATION_NOT_FOUND`, `DIRECT_ACCESS_FORBIDDEN`, and `FEATURE_DISABLED`.
Repeating an already completed unsend is a successful idempotent response, not an error. An
expired/foreign unsend leaves the message visible and does not retry.

## Push policy

The existing durable push outbox may deliver only these notification types:

- incoming Friend Request;
- accepted Friendship; and
- incoming Direct Message when the recipient is not viewing that Direct conversation.

Direct-message notifications are generic and contain no text, image, media URL, sender preview,
or user-authored content. The mobile foreground handler suppresses a Direct notification for
the focused authorized conversation; the server's `chat:direct:focus` state is short-lived and
prevents background delivery while a live session is viewing it. Push data contains only a
typed notification kind and conversation/attempt ID needed for safe routing.

There is no push for request rejection/revocation, unfriend, block/unblock, presence, Going,
reactions, unsend, typing, or individual Event Chat messages. Event announcements retain their
existing separate product policy and are never mistaken for chat-message pushes.

## Three-layer implementation and cache ownership

Create typed endpoint modules for Friends, Direct Chat, and engagement; query/mutation hooks
under `src/hooks/queries/` and `src/hooks/mutations/`; and aggregate Friends/Chat hooks with
named exported result interfaces. Every export gets TSDoc and explicit types. All requests
use `axiosInstance`, all paths are version-free, and no endpoint double-unwraps the response.

Suggested key families are:

```typescript
friendsQueryKeys = {
  all: ['friends'] as const,
  list: (cursor: string | undefined) => [...friendsQueryKeys.all, 'list', cursor] as const,
  requests: (direction: 'incoming' | 'outgoing') => [...friendsQueryKeys.all, 'requests', direction] as const,
  profile: (userId: string) => [...friendsQueryKeys.all, 'profile', userId] as const,
  presence: () => [...friendsQueryKeys.all, 'presence'] as const,
  going: () => [...friendsQueryKeys.all, 'going'] as const,
  settings: () => [...friendsQueryKeys.all, 'settings'] as const,
};

chatQueryKeys = {
  all: ['chat'] as const,
  summaries: () => [...chatQueryKeys.all, 'summaries'] as const,
  directSession: (conversationId: string) => [...chatQueryKeys.all, 'direct-session', conversationId] as const,
  directMessages: (conversationId: string) => [...chatQueryKeys.all, 'direct-messages', conversationId] as const,
};
```

Use `useInfiniteQuery` for every cursor list and expose flattened items, `fetchNextPage`,
`hasNextPage`, loading, error, and pending flags. Summary rows never trigger history queries.
Use TanStack cache patching for socket events; Zustand holds only client state such as current
focus and draft/picker state. Do not create a SQLite chat outbox. A failed text/image send
remains a visible explicit retry draft.

On block, filter only blocked-sender messages immediately and preserve both Event and Direct
conversation rows; blocking never evicts an entire conversation row. Patch each row's latest
visible preview, unread count, and capability from the directional server response, and patch
loaded history to the messages this User may still see. If a Direct session becomes unreadable,
show that access state on the retained row/thread rather than deleting the row; close a focused
thread only after the server explicitly revokes read access. Do not blindly delete a
conversation cache. On unfriend, preserve read-only Direct history while the server denies
send/access. On account deletion, DS-81 clears all query families and tears down the shared
socket before login.

## Accessibility, privacy, and visual rules

- Segment controls expose selected state and labels; request actions say **Accept friend
  request**, **Reject friend request**, and **Revoke friend request**. Cooldown warnings read
  the exact server `retryAt` in the User's locale.
- Friend profiles use safe display fields and content descriptions for avatars. No email,
  Google ID, provider, exact attendance/check-in, or moderation state is rendered.
- Chat rows identify Event versus Direct in words, include unread counts, and expose the **Photo**
  preview literally. No private signed URL or message content is placed in a notification.
- Seen, reaction, unsend, report, and block actions expose their roles, selected/busy states,
  and exact labels. Long press always has a labelled alternative action.
- Reaction glyphs are the sole narrow system-native emoji exception. All other UI copy,
  labels, errors, notifications, and icons use words and `lucide-react-native` icons.
- Every screen supports light/dark semantic tokens, safe areas, keyboard avoidance, and font
  scales that wrap instead of clipping. Use `Loading`, `ErrorView`, and `Empty` for foreground
  states and keep stale content during background refresh.

## Automated tests (write first)

### Friends branch

- Endpoint tests pin code lookup/regenerate normalization, request/accept/reject/revoke,
  cursor parameters, list/profile paths, unfriend, presence heartbeat, Going, and settings;
  fake responses include exact `retryAt` and stable typed errors.
- Query/mutation tests cover four hub segments, Incoming/Outgoing separation, server ordering
  and unread counts, no history prefetch, stable active-carousel ordering, code cooldown copy,
  autoaccept, pending non-expiry, and cache invalidation after social state changes.
- Privacy tests cover deleted/suspended/SuperAdmin filtering, safe profiles, presence/Going
  opt-outs, symmetric privacy from both sides of a directional block, no exact check-in state,
  and no direct identifier leakage. Presence tests cover one bounded response of at most 20,
  the opaque screen session, stable ordering within one session, and the absence of a presence
  cursor, `nextCursor`, or invented offset.

### Direct branch

- Direct endpoint tests cover lazy first-send creation, canonical pair reuse, text/multipart
  paths, cursor history, read cursor, unfriend read-only behavior, block denial, and server
  summary ordering.
- Shared-socket tests cover Event + Direct listeners on one connection, fresh ticket/reconnect,
  focus events, duplicate/out-of-order message patches, summary invalidation, and teardown.
- Seen tests prove foreground loaded-list gating, monotonic any-device advancement, latest
  outgoing-only label, no Event Seen UI, transient spinner/failure, and no toggle.
- Push tests prove generic Direct copy/no content or image preview, suppression while focused,
  and absence of Event-message/reaction/presence/unfriend/block pushes.

### Engagement branch

- Reaction tests cover the five wire values and exact labels, one reaction per User/target,
  same-value removal, different-value replacement, text/image and Event/Direct targets,
  counts-only Event/Direct responses, no push, announcement participant counts/myReaction,
  no attendee names, owner/admin Web-only identities, and retained former reactions.
- Unsend tests cover own text/image only, server 15-minute authority, long-press confirmation,
  tombstone replacement, hidden reactions/media, no delete-for-me/edit/typing, and recipient
  reportability for 30 days.
- Cross-feature tests cover directional blocked-message filtering without evicting Event or
  Direct conversation rows, preview/history/capability patching, image Photo summaries/private
  URL refresh, query clear on account deletion, light/dark/font-scale/safe-area/keyboard
  layout, and every `Loading`/`ErrorView`/`Empty`/explicit-retry branch.

## Android manual journeys

Run each journey on a connected Android emulator with the display awake. Resolve its current
serial with `adb devices -l`; do not couple journeys to an AVD name or reassigned serial. Use
`android layout --device <device-serial> --pretty` as the primary inspection tool;
use screenshots only as secondary evidence, captured with
`android screen capture --device <device-serial> -o <evidence-path>.png`. Use the
`ds99-friend-a`, `ds99-friend-b`, `ds99-friend-c`, `ds99-direct-existing`,
`ds99-presence-friends-01..21`, and `ds99-event-announcement` fixture roles
from `docs/superpowers/specs/2026-09-01-app-store-manual-qa-fixtures.md`; never use the named
SuperAdmin, Business, or User accounts. Resolve `<second-device-serial>` independently for
the Direct Seen and push cases and use `android layout --device <second-device-serial> --pretty`,
`android screen capture --device <second-device-serial> -o <evidence-path-device-b>.png`, and
`adb -s <second-device-serial> shell input tap <x> <y>` (and the corresponding serial-scoped
swipe/text commands) for device B.

The later CLI runner captures `android layout --device <device-serial> --pretty` before and after
each XML action, then uses element centers/bounds from the JSON with
`adb -s <device-serial> shell input tap <x> <y>`, slow scrolls with
`adb -s <device-serial> shell input swipe <x1> <y1> <x2> <y2> 500`, and focused-field input
with `adb -s <device-serial> shell input text`. Capture a secondary image with
`android screen capture --device <device-serial> -o <evidence-path>.png` only for visual
review. Any network/push/storage/server fixture controls are recorded as setup commands
outside the XML action text; the shared fixture runbook defines the push sink and observation
window.

Before the message-engagement journey, use the shared fixture runbook to start the local push
sink, background the recipient device, clear notifications and sink events between cases, and
reset fresh fixture pairs for each social-state trigger. These are out-of-band controls, not
XML actions.

```xml
<journey name="DS-99 Friends hub">
  <description>Verify the four-tab Friends hub, requests, safe profiles, carousel, and exact cooldown copy.</description>
  <actions>
    <action>Verify the four bottom tabs are Map, My Events, Friends, and Profile.</action>
    <action>Tap Friends and verify Add Friend and My Code are visible.</action>
    <action>Verify Chats, Friends, and Requests segments are visible.</action>
    <action>Open Requests and verify Incoming and Outgoing segments are visible.</action>
    <action>Open My Code and verify a 12-character code can be copied without exposing account credentials.</action>
    <action>Open Add Friend, enter ds99-friend-b's generated code, and verify only the safe profile preview is shown.</action>
    <action>Open the standalone safe profile preview and verify Block user is available but Report user is absent without an authorized conversation context.</action>
    <action>Send the request and verify it appears in Outgoing with the server status.</action>
    <action>Trigger the request cooldown and verify the warning shows the exact retryAt local date and time.</action>
    <action>On device B, accept ds99-friend-a's request and verify both Friends lists update without creating an empty Direct conversation.</action>
    <action>Load active-friend presence once and verify the response contains at most 20 eligible friends plus an opaque screen session, exposes no nextCursor, and offers no presence pagination.</action>
    <action>Verify active friends appear in stable order during the focused screen and no exact last-seen time is shown.</action>
  </actions>
</journey>

<journey name="DS-99 Direct Chat and Seen">
  <description>Verify lazy canonical Direct Chat, mixed summaries, foreground Seen, and unfriend behavior.</description>
  <actions>
    <action>Open Chats and verify Event and Direct summaries can share one server-ordered list.</action>
    <action>Verify a Photo last-message preview is shown as the word Photo.</action>
    <action>Open ds99-friend-b's safe profile and verify Message friend is available without creating an empty Direct row.</action>
    <action>Tap Message friend and verify the Direct composer resolves the accepted pair without fetching message history.</action>
    <action>On device A, send one text message and verify the canonical Direct message and row appear once.</action>
    <action>Reopen the Direct row and verify history is fetched only after the thread opens.</action>
    <action>Open the same Direct conversation on the second disposable device as the accepted friend fixture and verify the latest outgoing message shows Seen only after the foreground read is committed.</action>
    <action>Background the thread and verify merely receiving a message does not advance Seen.</action>
    <action>Unfriend one disposable pair and verify the conversation/history remains read-only with no push.</action>
    <action>Using a separate fresh accepted pair, block the fixture from a disposable Direct row and verify the row remains while the blocked sender's preview/history/capability is patched to the directional server result.</action>
    <action>Verify that the fresh blocked pair is absent from both Users' Friends, presence, Going, and profile results while Event Chat visibility for other participants is unchanged.</action>
  </actions>
</journey>

<journey name="DS-99 message engagement">
  <description>Verify reactions, announcement acknowledgement privacy, unsend, and generic push policy.</description>
  <actions>
    <action>On device A, long-press a text message and verify the five reaction controls have word-based accessibility labels.</action>
    <action>Select Heart reaction and verify one count and myReaction appear.</action>
    <action>Select Heart reaction again and verify it is removed; select another reaction and verify replacement.</action>
    <action>On device A, long-press the own message within 15 minutes, choose Unsend, and confirm Unsend for everyone.</action>
    <action>On recipient device B, open the same conversation and verify the message becomes Message unsent, hides reactions/media, and still exposes Report message during the retention window.</action>
    <action>On device A, open an eligible Event Hub Announcement and verify counts plus myReaction without attendee names.</action>
    <action>With device B backgrounded, verify the reaction produces no notification during the 30-second observation window.</action>
    <action>On device A, unsend the own message while device B is backgrounded and verify no notification during the 30-second observation window.</action>
    <action>Send one Event Chat message from device A while the fresh recipient device B is backgrounded and verify no individual Event-message notification is generated during the 30-second observation window.</action>
    <action>Focus Friends on device A with a fresh active friend fixture, allow one heartbeat, and verify presence produces no notification during the 30-second observation window.</action>
    <action>From device A, unfriend one fresh accepted pair and block another fresh pair while each recipient device B is backgrounded, verifying neither action produces a notification during the 30-second observation window.</action>
    <action>On device A, send one Friend Request to device B's fresh fixture while device B is backgrounded and verify one generic permitted notification contains no user-authored content.</action>
    <action>On device B, accept that request while device A is backgrounded and verify one generic accepted-Friendship notification contains no user-authored content.</action>
    <action>On device A, send one Direct message while device B is not viewing the conversation and verify one generic permitted notification contains no text, image, or sender preview.</action>
  </actions>
</journey>
```

Record layout JSON for both device aliases, the Presence `screenSession`, cursor/`nextCursor` values for actual paginated lists,
canonical IDs, query/cache outcomes, accessibility labels, the 30-second observation window,
and push payloads with private content redacted. A missing server contract is recorded as a
blocked journey; local mock success is not a substitute for server authority.
