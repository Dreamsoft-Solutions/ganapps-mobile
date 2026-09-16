# ADR 0003: Nearby Location Sampling and Map Camera Constraints

**Date:** 2026-09-08
**Status:** Accepted

## Context

The Nearby filter (DS-51) shows Ganaps within a fixed radius of the user on the map tab.
Building it surfaced a set of platform and library behaviours that are invisible in the
code they constrain: nothing about `const USER_ZOOM = 13.4` reveals that Mapbox measures
zoom against 512 px tiles, and nothing about an `isAccuracyNoticeVisible` expression
reveals that iOS reports reduced precision to apps it has denied outright.

Each of these cost a debugging session at least once. Two of them shipped as bugs before
being found by looking at the running app rather than at tests: a zoom derived with the
wrong tile size hid a matched event off-screen, and a camera centring call was discarded
because it ran before the native map was ready.

They are recorded here rather than as comments beside the code because the repo's
`pre-commit` hook rejects standalone explanatory comments, on the principle that code
needing explanation should be rewritten instead. That principle holds for most of what
was written during DS-51, and those comments were deleted. It does not hold for external
facts about iOS and Mapbox, which no amount of renaming can make visible.

## Decision

Six constraints hold across `src/app/(app)/(home)/index.tsx`, `src/hooks/useNearbyLocation.ts`,
`src/hooks/useGanapsMap.ts`, and `src/components/map/ClusteredGanapMarkers.tsx`.

### 1. Coordinates are rounded to 2 decimal places before leaving the device

`location.service.ts` rounds every coordinate to 2 dp, quantising position to a roughly
1.1 km grid. Apple defines coarse location as lower precision than three decimal places,
so this is what makes the app's coarse-location posture (DS-83) accurate rather than
aspirational. The rounded value is what the server geo filter receives and what the camera
centres on.

### 2. Position is sampled on foreground, never watched continuously

`useNearbyLocation` re-reads position when `AppState` becomes `active`, and on each toggle
of the filter. It does not use `watchPositionAsync`.

iOS returns an app from the background without remounting, so a mount effect alone would
leave the position wherever it was when the app was last opened. A continuous watch would
fix that too, but at a cost with no benefit: because 2 dp quantises position to a ~1.1 km
grid, a watch would burn battery producing a stream of identical rounded coordinates, and
continuous location is a materially stronger App Privacy claim to defend.

### 3. `USER_ZOOM` clears a minimum visible span on every supported screen

**Mapbox measures zoom against 512 px tiles**, so its zoom *z* covers half the ground of
the same number in a 256 px scheme. Deriving a zoom from the widely quoted
`156543 * cos(latitude) / 2^z` gives a value one full step too tight. That mistake shipped
once already, hiding a matched event off-screen.

`USER_ZOOM = 13.4` is chosen so at least `MIN_VISIBLE_SPAN_KM` (2.5 km) is visible on the
narrowest screen the app supports. The iOS deployment target is 16.4, which excludes the
320 pt iPhone SE 1st gen, so the floor is 375 pt.

| Device | Width | Visible at 13.4 |
|---|---|---|
| iPhone SE 2nd/3rd gen, 13 mini | 375 pt | 2.67 km |
| iPhone 15 / 16 / 17 | 393 pt | 2.80 km |
| iPhone 17 Pro Max | 440 pt | 3.13 km |

`src/utils/map-viewport.test.ts` asserts this for every width in
`SUPPORTED_VIEWPORT_WIDTHS_POINTS`, so raising the zoom past roughly 13.49 fails a test
rather than quietly cropping the map on small phones.

**The viewport deliberately does not cover the whole matched area.** At
`NEARBY_RADIUS_KM = 2` the filter spans 4 km, while the widest screen shows 3.13 km. Nearby
therefore matches some events that are off-screen until the user pans, which is an accepted
trade: covering the full diameter would mean zooming out to roughly 12.8 and losing the
street-level detail that makes the map worth looking at. What this costs is that "Nearby"
cannot be read off the viewport, which is what DS-110 exists to communicate.

### 4. The camera centres on visible space, not on the MapView's geometric centre

The search bar and filter chips float above the map and the tab bar sits below it, so the
midpoint of the `MapView` is not the midpoint of what the user can see. Camera stops carry
`padding` for that furniture. Without it the user is centred behind the search bar and
nearby pins sit under the chrome, which is indistinguishable from their being absent.

### 5. Initial centring waits for `onDidFinishLoadingMap`

The map screen renders a spinner while the Ganaps query is loading, so `MapView` — and the
camera ref with it — does not exist during the first load. On a warm launch the device
position resolves inside that window.

Waiting for the map to *mount* is not sufficient: the native map also discards camera stops
set before it reports itself loaded, then settles on its declarative props. Centring is
therefore gated on `onDidFinishLoadingMap`, and the one-shot guard is only spent once a
stop has actually been handed to a ready map. Gating on either weaker condition strands the
camera on the city centre for the rest of the session.

### 6. The reduced-accuracy notice requires the grant, not just the accuracy

**iOS reports precision as limited whenever precise access is absent — including when the
user has denied location entirely.** Testing `accuracy === 'reduced'` alone therefore shows
"Precise Location is off" beside the "Location is off" notice, telling a denied user two
contradictory things at once. The notice requires `granted === true` as well.

Related: `MarkerView` hides markers that overlap the location puck unless
`allowOverlapWithPuck` is set. It defaults to `false`, and it is needed on every marker
type, not only clustered ones. When the render log reports N features and the screen shows
N−1, this is the first thing to check.

## Alternatives Considered

1. **Keep the reasoning as comments beside the code** — rejected by the `pre-commit`
   standalone-comment policy, which is right often enough to be worth respecting. The
   facts here are the narrow exception, and an ADR is where this repo already puts
   reasoning a teammate would otherwise undo.
2. **Request temporary full accuracy when precision is reduced** — would undo the
   coarse-location posture in DS-83 for a cosmetic gain. The notice explains the
   degradation instead.
3. **Let the user choose the Nearby radius** — more surface than the feature warrants
   today, and it multiplies the coupling in constraint 3 across every value. Revisit if
   users ask for it.
4. **Derive `USER_ZOOM` from `NEARBY_RADIUS_KM` at runtime** — the arithmetic is only
   correct for a viewport width and latitude the code would have to assume, and the two
   values are no longer meant to match anyway. A test asserting the minimum span across
   supported widths gives real protection without pretending to that generality.
5. **Zoom out far enough to contain the whole 4 km diameter** — roughly 12.8, which loses
   the street-level detail that makes the map legible. Rejected in favour of a closer
   view plus DS-110 explaining the filter's reach.

## Consequences

- Raising `USER_ZOOM` past the point where the narrowest screen shows
  `MIN_VISIBLE_SPAN_KM` fails a test rather than silently cropping small phones.
- The matched radius and the visible span are now independent knobs. Changing
  `NEARBY_RADIUS_KM` alone no longer breaks a test, because the viewport is not expected
  to contain the whole radius — so a change there needs a deliberate look at whether
  DS-110's copy still describes what users get.
- Nearby results can be several kilometres out when Precise Location is off. The user is
  told so by the reduced-accuracy notice rather than left to infer it.
- The location puck does not render at all under reduced accuracy — tracked as DS-112,
  cause unconfirmed at time of writing.
- The app never holds a position fresher than the last foreground transition or filter
  toggle. For an event-discovery app at city scale this is ample; it would not be for
  turn-by-turn anything.
- Users on a 375 pt screen see about 15% less ground than a Pro Max at the same zoom. The
  minimum span is what guarantees the small screen stays usable, not the average one.
- A single fixed zoom holds only because every shipped screen sits in a narrow band.
  `UIDeviceFamily` is iPhone-only and `supportsTablet` is unset, so an iPad runs the app
  in compatibility mode at an iPhone width and is unaffected. Enabling tablet support
  would invert the problem rather than extend it: at 13.4 an iPad shows 5.3 km to 9.7 km
  against a 4 km matched area, so most of the screen would be empty of Nearby results and
  the minimum-span test would pass while catching nothing. Tablets need a zoom derived
  from viewport width, not this constant.
