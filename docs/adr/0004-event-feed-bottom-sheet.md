# ADR 0004: Event Feed Lives in a Bottom Sheet on the Map Tab

**Date:** 2026-09-17
**Status:** Accepted

## Context

The MVP lists an event feed alongside the map as a way to browse events, and DS-44 adds it.
Only the map existed; `src/components/lists/GanapList.tsx` had been written in DS-19 but was
imported nowhere.

Browsing by map alone does not scale to the city-wide scope adopted on 2026-09-05. A pin says
where an event is but not what it is, so finding "something on Saturday" means tapping pins
one at a time.

The ticket framed the choice as a toggle on the map tab versus a fifth tab, and preferred the
toggle. Both readings missed a constraint that mattered more: the map tab already carried two
bottom surfaces — `SelectedGanapCard` for a tapped pin (DS-19) and `ClusterEventsSheet` for a
tapped cluster (DS-74). A feed placed anywhere near the bottom would have been the third thing
competing for that space.

## Decision

The feed is a drag-to-expand bottom sheet over the map, and it is the tab's **only** bottom
surface. `SelectedGanapCard` and `ClusterEventsSheet` are retired into it as two of its three
modes:

| Mode | Entered by | Body | Snap |
|---|---|---|---|
| `browse` | default | The cursor-paginated feed | Peek, user-draggable |
| `selected` | tapping a pin | That event alone | Forced to peek |
| `cluster` | tapping a cluster | The cluster's leaves, plus a zoom-in action | Forced to half |

`cluster` mode renders a local array — the cluster's leaves, derived client-side from the
map's single large page — rather than the infinite feed. The map holds one page of 100 for
clustering; the feed pages by cursor at 20. The sheet switches which of the two it shows.

Filter state lives in `useGanapFilters` and is composed by `useGanapDiscovery`, which feeds
the same `GanapListFilters` object to both the map query and the feed query. The two surfaces
therefore agree by construction rather than by synchronisation.

Mode and snap selection is a pure function, `resolveFeedSheetMode`, so the state machine is
testable without rendering a gesture.

## Alternatives Considered

1. **A fifth tab** — costs `AppTabBar` and `constants/routes.ts`, and separates browsing from
   the map that gives it spatial context. The tab bar is also already at four.
2. **A toggle on the map tab** — what the ticket preferred, and cheaper. Rejected because it
   makes the two views mutually exclusive: reading the list means leaving the map, losing the
   context that made the user open the map in the first place.
3. **Keeping all three bottom surfaces, with the feed sheet yielding to the other two** — a
   smaller diff that leaves a known layout problem in place and defers the cleanup
   indefinitely. Rejected deliberately, accepting a larger diff now.
4. **Hand-rolling the sheet on Reanimated and gesture-handler** — both are already installed,
   so no new dependency. Rejected because the drag-versus-scroll handoff at a list's scroll
   boundary is the one genuinely difficult part of this feature, and it is worse on Android.

## Consequences

- `@gorhom/bottom-sheet` (5.2.14) is a new dependency. It is JS-only on top of
  `react-native-reanimated` (4.5.0) and `react-native-gesture-handler` (2.32.0), both already
  present and deduped against it, so there is no native module and no prebuild change.
  `BottomSheetFlatList` is the reason for taking it: it solves the scroll handoff.
- The map and the feed issue two requests to `/ganaps` for the same filters, under different
  cache keys (`list` versus `list/infinite`). Accepted: sharing a key would give one of them
  the wrong page size, and a map that only pins the pages the user has scrolled to is worse
  than a duplicate request.
- The sheet covers the bottom of the map at rest. `FEED_SHEET_PEEK_HEIGHT` is therefore read
  by the screen as well: the map camera pads for it, and anything floating over the map —
  currently `LocateMeButton` — has to clear it. Anything new added over the map must too.
- That height excludes the tab bar, and the reason is worth writing down because the code
  reads as though it should include it. `src/app/(app)/_layout.tsx` sets
  `tabBarStyle.position: 'absolute'`, but `tabBarStyle` is only ever read by React
  Navigation's own `BottomTabBar`, and this app supplies a custom `tabBar` (`AppTabBar`).
  `BottomTabView` renders a custom bar as a flex sibling of the `flex: 1` screens container,
  so every screen already ends at the top of the bar. Padding for the bar on top of that
  double-counts it.
- `enableDynamicSizing` is turned off. Left at its default of `true`, the library injects a
  content-height detent and re-sorts the detent array, which silently reassigns the fixed
  indices `resolveFeedSheetMode` addresses by position. The snap points must also stay
  ascending for the same reason.
- Every card tap navigates to the event detail screen, including a cluster leaf. There is no
  longer an in-place "select this leaf on the map" step, because the sheet is itself the
  surface that step used to reveal.
- The public list response carries no organization logo, no verification flag, and no
  attendee cap, so the ported card degrades on all three rather than showing invented data.
  Restoring the verified badge or a `9/15` attendance count needs new fields on
  `PublicGanapListItemResponseDto`, which is a server conversation.
