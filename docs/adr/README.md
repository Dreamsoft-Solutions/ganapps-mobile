# Architecture Decision Records — Mobile

Records of decisions that shaped this app: why we chose what we chose, and what we gave up.
Committed and shared with the team.

Numbering is per-repo and sequential (`0001-`, `0002-`, …), matching `ganapps-web/docs/adr/`.
Mobile and web number independently — mobile's `0001` is unrelated to web's `0001`.

## When to write one

Write an ADR when a decision is hard to reverse, non-obvious to someone reading the code
later, or likely to be undone by a teammate who doesn't know the reasoning. Skip it for
routine choices that the code makes evident.

The architecture decisions already made in this app are summarized in `AGENTS.md` under
"Architecture Decisions" — token storage, Expo Router grouping, three-tier feature flags,
custom CVA primitives, the offline outbox, NativeWind v4. Backfill those as ADRs only if
someone needs the full alternatives-and-consequences reasoning.

## Format

Filename: `NNNN-kebab-case-slug.md`

```markdown
# ADR NNNN: Title

**Date:** YYYY-MM-DD
**Status:** Proposed | Accepted | Superseded by ADR NNNN

## Context
What situation forced a decision. Constraints, and what the other repos already do.

## Decision
What we chose, stated plainly in the present tense.

## Alternatives Considered
1. **Option** — why it lost.

## Consequences
What follows from this — what it enables, what it costs, what now has to stay true.
```

Superseding an ADR does not mean deleting it: mark the old one `Superseded by ADR NNNN`
and leave it in place.

## Index

- [ADR 0001: Type-Checked Route Table Using Object-Form Hrefs](0001-type-checked-route-table.md)
- [ADR 0002: Static Framework Linkage for iOS](0002-ios-static-framework-linkage.md)
- [ADR 0003: Nearby Location Sampling and Map Camera Constraints](0003-nearby-location-and-map-camera.md)
- [ADR 0004: Event Feed Lives in a Bottom Sheet on the Map Tab](0004-event-feed-bottom-sheet.md)
