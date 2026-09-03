# Ganapps Mobile Context

Ganapps Mobile is the app students use to discover campus events, register for them, attend, and leave feedback.

## Language

**Ganapps**:
The product name — one word, capital G only, in code, docs, and UI copy alike. The repos and the folders they live in stay lowercase (`ganapps-mobile`), but prose is capitalized.
_Avoid_: GanApps, GanApp, GANAPPS, Gan Apps, ganapps (in prose)

**Ganap**:
An event published by a Business and discovered by Users in the app. `Ganap` is the term used in code, types, and API paths; UI copy shown to students says "event".
_Avoid_: `Event` in code (it collides with DOM and React Native types), Activity, Listing, Happening

**User**:
A person using the mobile app to find and attend Ganaps. The default actor for every mobile screen.
_Avoid_: Customer, Client, Consumer, Member

**Attendee**:
A User in relation to one specific Ganap they hold a Registration for. Use it when the tie to a particular Ganap is what matters; use User otherwise.
_Avoid_: Participant, Guest, Goer, Joiner

**Organizer**:
A verified User who creates and runs Ganaps on behalf of a Business. Organizers work primarily in Ganapps Web, which suits managing events better than a phone screen; the mobile app surfaces what they publish, not the tools they publish it with. Only verified users can be Organizers today, to limit scams and unsafe events — the long-term intent is that any User can become one.
_Avoid_: Host, Creator, Event admin, Business owner (that names a specific `OWNER` membership role)

**Business**:
The organization a Ganap belongs to — CPU Republic, a council, a student org. Users attach to one through a membership carrying a role of `OWNER`, `ADMIN`, or `MEMBER`. UI copy shown to students says "organization".
_Avoid_: Company, Vendor, Club, Organizer, Organization (in code and API names)

**Registration**:
A User's record of intent to attend one Ganap — at most one per User per Ganap. It carries the status lifecycle and owns any form answers the User submitted.
_Avoid_: Booking, RSVP, Ticket, Signup, Enrollment

**Pending**:
A Registration awaiting the Organizer's decision. Exists only on Ganaps with `requiresApproval` set.
_Avoid_: Waitlisted (a different status with a different cause), Unconfirmed, Requested

**Waitlisted**:
A Registration held back because the Ganap's `maxAttendees` is full. Promoted automatically when the Ganap has `autoPromoteWaitlist` set.
_Avoid_: Queued, Standby, Pending (that status means awaiting approval, not awaiting space)

**Check-in**:
The act of an Attendee scanning the QR code the Organizer displays at the venue, which sends the Ganap's `qrHash` to the server. The attendee scans; the Organizer is scanned. Only a `REGISTERED` Registration can check in.
_Avoid_: Scan-in, Sign-in, Ticket validation, Attendance (that is the resulting record)

**Attendance**:
The record written when a Check-in succeeds — one per Registration. Its existence is what marks a Registration `ATTENDED`.
_Avoid_: Check-in (that is the act), Presence, Visit, Turnout

**Event Chat**:
The per-Ganap group conversation Attendees can join before the event starts. Restricted to the Business when the Ganap has `isChatBusinessOnly` set.
_Avoid_: Group chat, Room, Channel, Thread

**Direct Chat**:
A one-to-one conversation between two Users whose Friendship is accepted and not blocked. It
is created lazily by the first successful message and reuses one canonical conversation for
the pair; accepting a Friendship never creates an empty conversation.
_Avoid_: DM, Private chat, Inbox thread

**Announcement**:
A one-way message a Business posts to a Ganap, typed `GENERAL`, `REMINDER`, or `UPDATE`. Separate from the Event Chat — Users cannot reply to it.
_Avoid_: Notification (that is per-User and push-delivered), Post, Update (that names one type)

**Friendship**:
The accepted relationship between two Users, represented by one canonical unordered pair.
Friend requests are retained attempts against that pair; rejecting, revoking, or blocking does
not create a Direct Chat, and unblocking never restores a former Friendship.
_Avoid_: Follow, Contact, Connection

**Friend Code**:
A shareable 12-character uppercase Crockford identifier that a User can regenerate to help
another User find them. It identifies a target but is not a credential or sign-in secret.
_Avoid_: Invite code, Password, Token

**Saved Ganap**:
A Ganap a User has kept for later. Backed by the `SavedEvent` model server-side, which is historical naming — write "saved Ganap" in mobile code and "saved" in UI copy.
_Avoid_: Favorite, Bookmark, Liked (liking a Ganap is a separate action), Watchlist

**Registration Form**:
The Organizer-defined questions attached to a Ganap as form blocks, scoped either `REGISTRATION` (asked at signup) or `POST_ATTENDANCE` (asked afterwards). Always built dynamically from the Ganap — its fields are never hardcoded.
_Avoid_: Survey, Questionnaire, Custom fields, Registration questions

**Feedback**:
What an Attendee leaves after a Ganap: a rating, plus answers to any `POST_ATTENDANCE` form blocks.
_Avoid_: Review, Comment, Survey response, Rating (that is one part of it)

**Block**:
A directional moderation action by one User against another. The blocker no longer receives
the blocked User's messages or new Direct requests, while other Event Chat participants keep
their own server-authorized view. Blocking patches message history and previews but does not
delete whole Event or Direct conversation rows; unblocking does not restore Friendship or
requests.
_Avoid_: Friend request status, Mute, Delete conversation

**Presence**:
The coarse active state derived from a recent device heartbeat and shown only to accepted,
unblocked friends when visibility is enabled. It never exposes exact last-seen time or
location.
_Avoid_: Online location, Last seen, Tracking

**Going**:
A privacy-filtered summary that a friend is associated with an upcoming or ongoing published
Ganap. It does not distinguish `REGISTERED` from `ATTENDED` and is never a check-in indicator.
_Avoid_: Attendance, Check-in, Live location

**Seen**:
The Direct Chat read receipt shown only on the latest outgoing message after the other User's
server read cursor commits. Event Chat advances unread cursors but never shows a Seen label.
_Avoid_: Read everything, Delivered, Event Chat receipt

**Message reaction**:
One of the five permitted system-native reaction glyphs (`❤️`, `😂`, `👍`, `😢`, `😡`) applied
once per User per message in Event Chat or Direct Chat. Reactions are not general UI copy,
icons, or Announcement messages; eligible Announcements use the same glyphs as separate
acknowledgements.
_Avoid_: Emoji decoration, Like (a Ganap action), Comment

**Message unsent**:
The visible tombstone left when a User unsends their own text or image within the server's
15-minute window. It hides original content, media, and reactions but remains reportable by a
recipient during the 30-day evidence window.
_Avoid_: Deleted for me, Edited, Retracted
