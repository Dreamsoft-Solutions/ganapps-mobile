# DS-95 — Event Chat core for mobile

**Date:** 2026-09-01
**Repository:** `ganapps-mobile`
**Branch:** `feat/ds-95-mobile-chat-core` (from `dev`)
**Depends on:** Server Event Chat contract already present behind `feature_ganap_chat`
**Blocks:** `feat/ds-96-mobile-chat-moderation`
**Status:** Implementation-ready specification

The implementation PR must include the server contract/commit it targets in the PR
description. Any server change needed to satisfy this document is a cross-repository
dependency and must be landed/documented in the server repository before the mobile PR is
merged. This branch covers Event Chat core; moderation controls are the next dependent
branch and must be present before the feature is enabled for review.

## Outcome and boundaries

An eligible Attendee can open a Ganap's Event Chat, read cursor-paginated history, send text,
receive new messages live, and see an unread count. Event Chat is a group conversation for
one Ganap. It is separate from the Event Hub's one-way Announcements: announcements remain
owned by `useGanapAnnouncements`, `ganapQueryKeys.announcements(ganapId)`, and
`AnnouncementCard`; they are never inserted into the chat message query or counted as chat
messages.

This slice includes text only. Images are implemented by DS-98 after the moderation slice;
direct chat and the visible Friends hub are implemented by the DS-99 branches. There is no
SQLite chat outbox in v1. A failed text send remains an explicit in-memory failed draft with
**Retry** and **Discard** actions; it is never silently dropped or replayed by
`sync.service`.

## Existing mobile anchors

- `Routes.app.chat` is the `(app)/(chat)/chat` tab root. Keep the internal `(chat)` route
  group so route ownership remains stable even when its visible tab label changes to
  **Friends** in DS-99.
- `Routes.eventHub(ganapId)` owns the Event Hub screen. Its fixed header currently has a
  disabled chat icon; DS-95 replaces that disabled state with navigation to the event's
  Event Chat thread while preserving the existing share/back actions.
- The Event Hub route already guards with `canAccessEventHub`, passes all data into
  `EventHubView`, and uses `Loading`, `ErrorView`, `Empty`, `Button`, `IconButton`, `Text`,
  and `Card`. The chat screen follows those same primitives and token rules.
- `API_BASE_URL` already contains `/api/v1`; endpoint modules use version-free paths and
  `axiosInstance` so the response interceptor unwraps the server envelope once.
- TanStack Query is the server-state owner. Query keys are factories, and query defaults
  are five-minute stale time, ten-minute garbage collection, and one retry unless the
  endpoint has a more specific rule.

## Navigation and screen behavior

### Entry points

- Event Details/Event Hub exposes **Event Chat** only when the detail registration is
  `REGISTERED` or `ATTENDED` (the same local guard as `canAccessEventHub`). A server response
  remains authoritative if access changes while the screen is open.
- The chat tab's initial Event Chat list may show only server-provided readable Event Chat
  summaries in this branch. It must not fabricate rows from Ganap detail data. DS-99 replaces
  this list with the Friends hub and mixes Event and direct summaries without adding a fifth
  bottom tab.
- Dynamic routes are added to `src/constants/routes.ts` in object form. No screen or hook
  contains a literal `/(app)/...` navigation string. The eventual per-Ganap route has a
  typed `ganapId` parameter and the conversation ID comes from the resolved session.

### Event Chat list

The list reads `GET /chat/conversations?type=EVENT` and renders each server summary. Each row
identifies the event, the latest message preview (text only in this slice), an
absolute/relative timestamp, and an unread count. It is ordered by the server's
`updatedAt`/latest-message order. It does not fabricate rows from Ganap detail data or fetch
message history for every row. `Loading`, `ErrorView` with retry, and an `Empty` message are
required; a background refetch must keep rendered rows visible.

### Event Chat thread

On open, resolve the Ganap conversation first, then fetch the newest history page. The thread
shows the newest messages at the bottom, sender username/avatar, and sent time. When a message
is tapped/loaded in the foreground, the thread advances the read cursor through the newest
message actually loaded. A read request is never triggered by list prefetch or a background
refetch.

The composer is available only when `session.canSend` is true. If the server returns
`READ_ONLY` (for example, a completed Ganap or an `isChatBusinessOnly` attendee who can only
read), explain **You can read this chat, but you cannot send messages.** without showing a
misleading enabled input. Event Chat has no Seen label or per-message read indicator in the
UI. Read calls still maintain unread state for the list and allow the server to deliver
reliable cross-device counts.

If the User loses registration/business access, clear visible messages from the rendered
surface, stop sending/read attempts, and show an access-lost state with a route back to
Event Details. A 403 is not retried as if it were a network error.

## Server contract used by mobile

The following routes are the server contract targeted by this branch and remain behind
`feature_ganap_chat` (and the server's moderation gate where required):

| Method | Path | Request | Response |
|---|---|---|---|
| `POST` | `/api/v1/chat/socket-ticket` | Authenticated, verified User; empty body | `{ ticket: string, expiresIn: 60 }` |
| `GET` | `/api/v1/chat/conversations?type=EVENT&cursor=&limit=` | Authenticated readable User; cursor page, limit 1–50 | `{ items: EventChatSummary[], nextCursor: string \| null }` |
| `POST` | `/api/v1/ganaps/:ganapId/chat` | Authenticated User | `{ conversationId, ganapId, type: "EVENT", capability: "READ_ONLY" \| "READ_WRITE", canRead, canSend, isBusinessOnly, ganapStatus }` |
| `GET` | `/api/v1/ganaps/:ganapId/chat/messages?cursor=&limit=` | `limit` 1–50, default 30; opaque cursor | `{ items: ChatMessage[], nextCursor: string \| null }` |
| `POST` | `/api/v1/ganaps/:ganapId/chat/messages` | `{ clientMessageId: string, content: string }` | Persisted `ChatMessage` |
| `POST` | `/api/v1/ganaps/:ganapId/chat/read` | `{ throughMessageId: string }` | `{ conversationId, throughMessageId, readAt, readCount }` |

`EventChatSummary` is a server-owned projection, so the client does not derive rows or
unread counts from Ganap detail data:

```typescript
{
  conversationId: string;
  type: 'EVENT';
  ganapId: string;
  title: string;
  lastMessage: {
    id: string;
    type: 'TEXT' | 'IMAGE' | 'UNSENT';
    preview: string;
    sentAt: string;
  } | null;
  unreadCount: number;
  canRead: boolean;
  canSend: boolean;
  updatedAt: string;
}
```

The summary route is gated by `feature_ganap_chat` and the server's moderation gate. It
returns only conversations the current User can read, selects the latest visible message
after directional block filtering, and orders rows by `updatedAt DESC, conversationId DESC`.
The mobile list renders `Photo` for an image and `Message unsent` for a tombstone when those
types are present after DS-98/DS-99; this DS-95 branch sends only text.

`ChatMessage` currently has:

```typescript
{
  id: string;
  conversationId: string;
  senderId: string;
  senderUsername: string;
  senderDisplayPicture: string | null;
  content: string;
  type: 'TEXT';
  sentAt: string;
}
```

The response is already unwrapped by the mobile Axios interceptor. The server sorts history
newest first by `(sentAt DESC, id DESC)`. The hook preserves the page order in its flattened
data; the thread's inverted list or display adapter is responsible for visual bottom-up
ordering. The `nextCursor` is opaque and must be passed back unchanged.

The server authorizes every request, not just the initial route:

- A non-deleted, verified User with a `REGISTERED` or `ATTENDED` registration can read a
  visible Ganap (`PUBLISHED`, `ONGOING`, or `COMPLETED`).
- With `isChatBusinessOnly`, an active Business membership may read; sending is still
  allowed only while the Ganap is writable and the server grants `canSend`.
- A non-business Attendee can send only while the registration and Ganap status satisfy the
  server's write policy (`PUBLISHED`/`ONGOING`). No client-side role assumption overrides
  `session.canSend`.
- Cancelled, deleted, unregistered, rejected, pending, waitlisted, or otherwise inaccessible
  Users receive the typed global `FORBIDDEN`/`NOT_FOUND` result and no messages.

Messages use a required client-generated ID (1–100 characters) for idempotent retries. A
repeated ID is accepted only when the sender, conversation, content, and type match; a
mismatch is `CLIENT_MESSAGE_ID_REUSED`. The server must apply its objectionable-content filter before storage
as part of DS-94. The client must not describe a message as filtered merely because a local
heuristic matched it.

## Socket.IO lifecycle

There is one process-wide Socket.IO client connection for all Event Chat and future direct
chat. It connects to the HTTPS origin's `/chat` namespace with
`handshake.auth.ticket`, where the ticket came from `POST /chat/socket-ticket`. Use websocket
transport only (`wss` in production); never put an access token in a URL or log a ticket.

The event contract is:

| Direction | Event | Payload |
|---|---|---|
| client → server | `chat:join` | `{ ganapId }` |
| client → server | `chat:leave` | `{ conversationId }` |
| server → client | `chat:message:new` | canonical `ChatMessage` |
| server → client | `chat:message:read` | `{ conversationId, throughMessageId, userId, readAt }` |

The server also exposes socket commands for send/read, but mobile v1 uses REST for history,
send, and read so retries, error envelopes, and idempotency share one path. Socket commands
remain available for web and later migration; the mobile client must not issue the same send
through both transports.

The singleton owns:

- ticket acquisition and a short-lived ticket cache; obtain a fresh ticket before connecting
  or after an authentication error, never reuse a ticket after its 60-second expiry;
- one listener registry keyed by conversation ID, with room join/leave reference counts;
- disconnect/reconnect state, exponential backoff bounded at a user-visible retry state, and
  a `connectionState` exposed to the aggregate hook;
- removal of all listeners and room membership on logout, token loss, or account deletion.

On reconnect, re-authenticate with a fresh ticket, re-join each still-focused readable room,
refetch the active thread's history from the last known cursor/window, and patch the list from
the canonical response. A socket event is not a durable history guarantee: duplicate IDs are
deduplicated, out-of-order events are merged by `(sentAt, id)`, and a reconnect never loses a
message because the list is refetched.

The response interceptor remains responsible for normal HTTP 401 refresh. If refreshing the
access token fails, disconnect the singleton, clear auth through the existing store, and let
the root layout route to login. Socket ticket failures surface a retryable connection state
unless the server returns an auth/feature-disabled error.

## Three-layer client contract

### Endpoint layer

Create `src/api/endpoints/chat.ts` with typed functions for socket-ticket, Event Chat summary
pages, Ganap session, history, send, and read. Every function imports `axiosInstance`, uses a
version-free path, returns `res.data`, and has TSDoc. The endpoint tests use the existing fake
adapter to pin URL/query/body shape and prove that the response envelope is unwrapped exactly
once.

### Query and mutation layer

Create `src/hooks/queries/useChatQuery.ts` (or equivalent domain-specific modules) with a
query-key factory such as:

```typescript
chatQueryKeys = {
  all: ['chat'] as const,
  eventSession: (ganapId: string) => [...chatQueryKeys.all, 'event-session', ganapId] as const,
  eventMessages: (ganapId: string) => [...chatQueryKeys.all, 'event-messages', ganapId] as const,
  eventList: () => [...chatQueryKeys.all, 'event-list'] as const,
};
```

The history query is `useInfiniteQuery` with explicit generics, `initialPageParam: undefined`,
and `getNextPageParam: (page) => page.nextCursor ?? undefined`. It exposes flattened items,
`fetchNextPage`, `hasNextPage`, and pending/error flags. It is enabled only with a token and
a non-empty Ganap ID after the session/access guard. The send and read mutations use the
endpoint layer and invalidate/patch the corresponding message and list keys on canonical
success.

Do not use an offset page count for cursor pagination, do not fetch history while rendering a
list row, and do not cache server state in Zustand or SQLite. Failed sends remain an explicit
draft object held by the aggregate hook/screen:

```typescript
type FailedDraft = {
  clientMessageId: string;
  content: string;
  error: Error;
};
```

The retry action reuses `clientMessageId`. A server `CLIENT_MESSAGE_ID_REUSED` clears the draft only after the
client reconciles the matching canonical message; a network failure keeps it visible.

### Aggregated hook

`useChat` owns session resolution, the shared socket subscription, flattened history, list
summary patching, send/read actions, and connection state. Its result has a named exported
interface and explicit return types. It must expose `isLoading`, `error`, `refetch`,
`isSending`, `isMarkingRead`, `failedDrafts`, `retryDraft`, and `discardDraft` alongside the
message/pagination fields. Navigation stays in the route component and uses `Routes`.

On `chat:message:new`, patch the active message query and the event list summary only when
the conversation is readable; otherwise refetch after the next focus. On
`chat:message:read`, patch unread/read state without adding an Event Chat Seen label. A read
mutation advances monotonically to the greatest message ID/time currently loaded.

## Accessibility and visual rules

- The composer has a visible label, multiline keyboard-safe input, character limit feedback,
  and a send button with an accessible busy/disabled state. The failed row's buttons are
  explicitly labelled **Retry message** and **Discard message**.
- Long messages wrap; sender and timestamp remain available at large font scales. Use
  `useSafeAreaInsets`, keyboard-aware scrolling, semantic foreground/muted/card tokens, and
  both light and dark themes. Do not use emoji as an icon or copy.
- Every icon-only action has a content description via `IconButton`; chat rows expose a
  meaningful accessibility label including the event title and unread count.
- `Loading`, `ErrorView` with retry, and `Empty` are used for foreground states. A reconnect
  banner is non-blocking and does not replace already loaded messages.

## Automated tests (write first)

- Endpoint tests cover every URL (including Event summary pagination), query cursor/limit, send
  idempotency body, read body, ticket request, envelope unwrapping, typed 403, and typed 401
  behavior.
- Query tests cover server-ordered Event summaries, no history prefetch, initial history,
  cursor-page flattening, partial/empty final pages, explicit retry, disabled unauthenticated
  access, and no SQLite/outbox call.
- Mutation tests cover successful send/read invalidation, duplicate `clientMessageId`, failed
  drafts with explicit retry, no double send, and read cursor monotonicity.
- Socket tests cover one singleton connection for two screens, ticket expiry, reconnect with
  room rejoin, duplicate/out-of-order event deduplication, 401 teardown, and listener cleanup
  on logout.
- Screen tests cover Event Hub separation from announcements, access/read-only copy, loading,
  error, empty, unread count, no Seen label, keyboard-safe composer, and large-font wrapping.
- Route tests assert the new route entries use `Routes` object hrefs and the `(chat)` group
  remains the sole owner of the chat tab URL.

## Android manual journeys

Use a connected Android emulator with its display awake. Resolve its current serial with
`adb devices -l`; do not couple the journey to an AVD name or reassigned serial. Inspect with
`android layout --device <device-serial> --pretty` before each verification; use a
secondary screenshot only to confirm visual layout. Exercise the server with disposable
local fixtures, never the named SuperAdmin, Business, or User accounts.

The later CLI runner captures `android layout --device <device-serial> --pretty` before and after
each XML action, then uses element centers/bounds from the JSON with
`adb -s <device-serial> shell input tap <x> <y>`, slow scrolls with
`adb -s <device-serial> shell input swipe <x1> <y1> <x2> <y2> 500`, and focused-field input
with `adb -s <device-serial> shell input text`. For the offline branch, disable/restore
connectivity with `adb -s <device-serial> shell svc wifi disable` and
`adb -s <device-serial> shell svc wifi enable` outside the UI action, recording
the command in the result. Capture secondary visual evidence with
`android screen capture --device <device-serial> -o <evidence-path>.png` only. The shared
fixture roles, the `ds95-event-sender`/`ds95-event-reader` device-A/device-B mapping, and
the out-of-band setup contract are defined in
`docs/superpowers/specs/2026-09-01-app-store-manual-qa-fixtures.md`. Resolve
`<second-device-serial>` independently for the live-update action and use
`android layout --device <second-device-serial> --pretty`,
`android screen capture --device <second-device-serial> -o <evidence-path-device-b>.png`, and
`adb -s <second-device-serial> shell input tap <x> <y>` (and the corresponding serial-scoped
swipe/text commands) for device B. The network commands must be run before and after the
offline branch, never encoded as XML actions. Run the disable command immediately
before the retry-case send and restore connectivity immediately after the failed-send
assertion; record both results in the run report.

```xml
<journey name="DS-95 Event Chat core">
  <description>Verify guarded Event Chat history, send, live update, unread, and retry behavior.</description>
  <actions>
    <action>Verify that ds95-event-sender can see the writable Event Chat from Event Hub.</action>
    <action>Tap Event Chat.</action>
    <action>Verify that the thread shows a loading state, then history or the empty state.</action>
    <action>Verify that Announcements are not rendered as chat messages.</action>
    <action>On the secondary device, open the same Event Chat as ds95-event-reader and keep the thread foregrounded.</action>
    <action>Send one text message and verify the canonical message appears once.</action>
    <action>Verify that the new message arrives on the secondary device without a manual refresh.</action>
    <action>Return to the chat list and verify the server-ordered row and unread state.</action>
    <action>Reopen the thread and verify unread state clears without showing a Seen label.</action>
    <action>Send a text message and verify that an explicit Retry message action remains visible.</action>
    <action>Tap Retry message once and verify that the message appears once after reconciliation.</action>
    <action>Verify that ds95-event-read-only sees the access/read-only state and cannot send.</action>
  </actions>
</journey>
```

Record layout JSON for both device serial aliases, socket reconnect logs without credentials,
fixture labels, and the final server message IDs. A failed journey is reported as failed; do
not hide a missing server contract with a mocked success in the manual run.
