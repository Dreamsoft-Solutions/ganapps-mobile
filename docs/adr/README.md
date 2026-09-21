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

## Amending one

Superseding is for a decision that changed. Most edits are not that: the decision stands and a
consequence moved — work it deferred got done, or a cost it predicted never landed. Amend those
in place.

| Section | Amend it? |
|---|---|
| Context | No. It records the situation that forced the decision. Rewriting it to match what is true now hides what the call was actually made on |
| Decision | Wording only. A decision that genuinely changed is a new ADR — see superseding above |
| Alternatives Considered | No, for the same reason as Context |
| Consequences | Yes. This is the section that predicts, so it is the one that goes stale |

Two rules for the amendment itself:

- **Name what closed it.** "DS-119 closed it" is an amendment; "this is now handled" is a claim.
  A reader should be able to find the change that discharged the consequence.
- **Leave `**Date:**` and `**Status:**` alone.** They describe the decision, not the file. An
  ADR amended next year still records a decision made this one, and an ADR whose consequences
  have all landed is still `Accepted`.

Don't add a changelog section to the ADR. `git log -p docs/adr/NNNN-*.md` is the changelog, and
a hand-maintained one decays the same way the stale consequence did.

ADR 0005's `Button size="sm"` consequence is the worked example: it deferred a code change,
DS-119 made it, and the bullet now records the outcome — while the Context above it still
describes the gap that prompted the rule in the first place.

## Index

- [ADR 0001: Type-Checked Route Table Using Object-Form Hrefs](0001-type-checked-route-table.md)
- [ADR 0002: Static Framework Linkage for iOS](0002-ios-static-framework-linkage.md)
- [ADR 0003: Nearby Location Sampling and Map Camera Constraints](0003-nearby-location-and-map-camera.md)
- [ADR 0004: Event Feed Lives in a Bottom Sheet on the Map Tab](0004-event-feed-bottom-sheet.md)
- [ADR 0005: iOS and Android UI Each Follow Their Own Platform Guidelines](0005-platform-design-guidelines.md)
