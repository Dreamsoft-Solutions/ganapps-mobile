# App Store manual-QA fixtures

**Date:** 2026-09-02
**Repository:** `ganapps-mobile`
**Scope:** DS-81, DS-95, DS-96, DS-98, and DS-99 Android manual journeys

This document is the shared fixture contract for the app-store journeys. It describes
synthetic local/test data and the setup that must happen outside the XML journey actions.
It does not introduce a mobile production route or a second authentication mechanism.

## Safety and evidence rules

- Run only against an isolated local/test server, test database, test Firebase project, test
  object store, and test push sink. Never point a journey at production.
- Provision synthetic Users through the server QA fixture harness. The harness returns fixture
  labels, IDs, and one-time Friend Codes through the local operator output; login itself is
  performed in the app using operator-only, one-time login material. Do not copy bearer tokens,
  refresh tokens, passwords, provider IDs, signed media URLs, or private object keys into this
  document or a test report.
- Use a fresh fixture or an explicit harness reset between destructive, social-state, and push
  cases. Account deletion is irreversible for that fixture.
- Redact authorization headers and private content from HTTP, socket, storage, and push logs.
  Keep only the fixture label, canonical resource IDs, typed outcome/error code, timestamps,
  notification kind, and the minimum routing ID needed to reproduce the result.

## Fixture matrix

The IDs below are stable labels, not production usernames or credentials. The fixture harness
may generate different database IDs and Friend Codes on every run.

| Fixture label | Required state | Used by | Notes |
| --- | --- | --- | --- |
| `ds81-delete-verified` | Synthetic regular User, verified, no Business ownership | DS-81 | Main successful deletion journey; safe to destroy. |
| `ds81-delete-unverified` | Synthetic regular User, authenticated, email unverified | DS-81 | Must reach the same deletion flow from Verify Email without verification. |
| `ds81-delete-superadmin` | Synthetic SuperAdmin-role User in the isolated test environment | DS-81 | Refusal only; never use a provisioned or production SuperAdmin. |
| `ds95-event-sender` | Verified `REGISTERED` Attendee of a writable `PUBLISHED`/`ONGOING` Ganap | DS-95, DS-98 | Primary device A; can send text and image messages. |
| `ds95-event-reader` | Verified `REGISTERED` Attendee of the same Ganap | DS-95 | Secondary device B; receives live messages and unread updates. |
| `ds95-event-read-only` | Verified readable Attendee on a completed or Business-only read-only case | DS-95 | Cannot send; server capability is authoritative. |
| `ds96-moderation-viewer` | Verified Attendee with an authorized Event Chat and Direct fixture | DS-96 | Primary moderation/reporting actor. |
| `ds96-message-author` | Another verified User who authored the target text/media message | DS-96 | The message remains reportable while its evidence window is open. |
| `ds96-profile-target` | Verified User with an authorized conversation context when reporting a profile | DS-96 | Bind this to `ds96-message-author` for the profile-report case, or make it the other participant in the authorized conversation; a standalone Friends profile has no Report user action until the server supplies a supported scope. |
| `ds99-friend-a` | Verified User with a generated Friend Code | DS-99 | Primary device A; starts requests and Direct messages. |
| `ds99-friend-b` | Verified User with a generated Friend Code | DS-99 | Secondary device B; accepted friend, recipient, and foreground Seen actor. |
| `ds99-friend-c` | Verified User with an independent generated Friend Code | DS-99 | Fresh pair for block, unfriend, privacy, and push-negative cases. |
| `ds99-direct-existing` | Verified accepted pair with one canonical Direct conversation and a Photo summary | DS-99 | Seeds the mixed Chats feed without being the lazy-creation pair. |
| `ds99-presence-friends-01..21` | At least 21 verified accepted friends with active heartbeats | DS-99 | Proves the bounded carousel returns at most 20 without pagination; include one visibility opt-out case and no exact last-seen data. |
| `ds99-event-announcement` | Eligible `REGISTERED`/`ATTENDED` fixture and an Event Hub Announcement | DS-99 | Mobile sees aggregate counts and `myReaction`, never acknowledger identities. |

The shared server fixture also needs these bounded records:

- one Event Chat corpus with a text message, an image message after DS-98, an unread message,
  an Announcement that is not a Chat message, and a completed/read-only variant;
- one accepted friend pair with no Direct conversation before the first send, then one
  canonical Direct conversation after the first successful send;
- at least 21 accepted friends with active heartbeats so the bounded Presence response can be
  proven to stop at 20 with no next page, plus independent settings/block cases for both
  privacy directions;
- one pair for each independent unfriend/block/privacy case, because a block ends friendship
  and must not be silently undone by a later case;
- one message and one Announcement reaction corpus containing zero-count and nonzero-count
  values; and
- a local image corpus containing `valid-jpeg-under-5m.jpg`, `valid-png-under-5m.png`,
  `valid-static-webp-under-5m.webp`, `animated-webp.webp`, `malformed-image.jpg`,
  `unsupported-type.txt`, and `input-over-5m.jpg`; the latter cases must exercise the server
  response rather than a client-side animation or decode classifier.

## Provisioning and preflight

The mobile repository has no fixture provisioner. Before a manual run, the server QA owner
must provide an equivalent isolated fixture-harness command for the following interface. The
command name is a harness contract, not a mobile API route:

```text
fixturectl provision \
  --manifest docs/superpowers/specs/2026-09-01-app-store-manual-qa-fixtures.md \
  --environment local \
  --run-id <qa-run-id> \
  --output <fixture-record-path>
```

The output must identify each fixture label, role/state, Event/Ganap IDs, conversation IDs
when they exist, generated Friend Codes, and reset dependencies without printing credentials
or tokens. If the harness cannot create a required state, mark that journey blocked before
opening the destructive action; do not substitute a named account.

Reset only the named synthetic scope between cases; never reset a shared or production
database:

```text
fixturectl reset --run-id <qa-run-id> --scope <fixture-label>
```

Resolve devices after provisioning and keep the mapping in the private run record:

```text
adb devices -l
android layout --device <device-serial> --pretty
android screen capture --device <device-serial> -o <evidence-path>.png
```

For a two-device journey, resolve `<second-device-serial>` independently and use it for every
layout, screenshot, tap, swipe, and input command issued to device B:

```text
android layout --device <second-device-serial> --pretty
android screen capture --device <second-device-serial> -o <evidence-path-device-b>.png
adb -s <second-device-serial> shell input tap <x> <y>
```

The runner captures layout JSON before and after each XML action. Use the resolved serial for
all normal input commands:

```text
adb -s <device-serial> shell input tap <x> <y>
adb -s <device-serial> shell input swipe <x1> <y1> <x2> <y2> 500
adb -s <device-serial> shell input text <focused-value>
```

## Out-of-band failure and notification controls

Do not place setup commands in a `<journey>` action. Record the command and its result in the
run report, then execute the UI action that verifies the resulting state.

For the offline retry branch, disable and restore connectivity on the device under test:

```text
adb -s <device-serial> shell svc wifi disable
adb -s <device-serial> shell svc wifi enable
```

For DS-98 signed-URL expiry, first mint a dev fixture URL with the normal 300-second contract,
hold it until its server-provided `expiresAt` has passed, and configure the isolated fixture to
replay that naturally expired bearer for one image-load response. Then restore ordinary URL
minting. Never shorten the signer TTL and never change the device or server clock. The fixture
record must show the original 300-second lifetime, expiry time, controlled replay result, and
single expected refresh; it must not contain the URL, signature, or object key.

For DS-99 push checks, start the local push sink before the journey, clear notifications and
sink events between cases, and keep the recipient app backgrounded for delivery tests. The
sink command is harness-provided and must record only notification kind, routing ID, timestamp,
and safe payload keys:

```text
fixturectl push-sink start --run-id <qa-run-id>
fixturectl push-sink clear --run-id <qa-run-id>
fixturectl push-sink stop --run-id <qa-run-id>
```

Use a 30-second observation window unless the isolated push service documents a shorter,
deterministic window. Test each allowed notification (incoming Friend Request, accepted
Friendship, and unfocused Direct Message) separately from each forbidden notification case
(reaction, unsend, Event message, presence, unfriend, and block).

The fixture driver must also expose a redacted `PushOutbox` assertion for the trigger and
recipient. For each allowed notification, record that one matching row was committed and
reached `SENT` (or the documented terminal test-delivery status), then correlate its safe
notification ID with one sink event and the device display. For each forbidden notification,
record that no matching `Notification` or `PushOutbox` row was created during the observation
window. Never print `tokenSnapshot`, notification body, bearer data, or user-authored content.
If this redacted server assertion is unavailable, mark the push journey blocked rather than
treating an empty device tray as proof.

## Required run record

For every journey, record:

1. the run ID, fixture labels, device serial aliases, app/server build identifiers, and feature
   flags without credentials;
2. layout JSON before/after each action and screenshots only when visual confirmation adds
   evidence, always with the resolved `--device`;
3. canonical message, conversation, report, reaction, request, and deletion IDs as applicable;
4. server status/error codes, cursor/`nextCursor` values for paginated endpoints, the Presence
   `screenSession`, and the final authoritative response;
5. for push cases, the observation window, background/foreground state, redacted
   `PushOutbox`/`Notification` assertion, sink events, and whether the device displayed a
   notification; and
6. a blocked reason when a required server, storage, clock, push, or fixture capability is
   unavailable. A local preview or mocked success is not a passing server journey.
