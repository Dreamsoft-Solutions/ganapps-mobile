# ADR 0005: iOS and Android UI Each Follow Their Own Platform Guidelines

**Date:** 2026-09-19
**Status:** Accepted

## Context

This app ships to both stores from one React Native codebase, and `docs/DESIGN.md` governed
only the parts of design that are platform-neutral — colors, type, spacing, radii, component
patterns. It said nothing about behaviour. Its single acknowledgement that the two platforms
differ at all was a note that Android synthesizes font weight over `Inter-Regular`.

That gap was survivable while Android was the only shipping target. The iOS App Store launch
(DS-79) changes it: Apple's Human Interface Guidelines are review surface, not advice, and Play
applies its own. A control that is fine on one store can be a rejection on the other.

The gap also showed up as inconsistency in the code rather than as an argument. Keyboard
avoidance branches on `Platform.OS` in five components, `BackHandler` appears in ten places,
and `Toast.tsx` sets `ReduceMotion.System` explicitly — each one a correct platform-aware
decision made locally, none of them written down, so the next screen re-litigates it or skips
it. `Button` `size="sm"` is about 36px tall, under both platforms' minimums, which is what that
looks like when the decision gets skipped.

A further constraint shaped where the rule lives rather than what it says: this repo is worked
by several agent harnesses — Claude Code, Codex, opencode. A convention only Claude Code can
read is a convention that applies on some days.

## Decision

iOS UI follows the [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines);
Android UI follows the [Android design guidelines](https://developer.android.com/design) and
the Material 3 system beneath them. Both bind. Neither is a default the other inherits.

Conflicts resolve by what kind of thing is in conflict:

- **Interaction affordance** — how a surface is dismissed, where a control sits, how large it
  must be to hit. The platform guideline wins; branch on `Platform.OS`.
- **Ornament** — corner radii, elevation, motion curves, color. This design system wins, so the
  app still looks like itself on both.

Where a size threshold differs and branching would buy nothing, the control clears the stricter
of the two rather than branching.

The rule is placed by reach, not by topic:

| File | Carries | Why there |
|---|---|---|
| `AGENTS.md` | A three-line pointer | The one file every agent harness reads; Claude Code reaches it through `CLAUDE.md`'s `@AGENTS.md` import |
| `docs/DESIGN.md` | The substance, as `## Platform conventions` | Already the doc that UI work is told to read first |
| `docs/agents/review-reference.md` | A checklist item and an audit row | Makes the rule checked rather than only read |

## Alternatives Considered

1. **HIG only, letting Android inherit it** — what was originally asked for, and the cheaper
   rule. Rejected on the numbers: HIG's 44×44pt minimum is below Android's 48×48dp, so an
   iOS-shaped control is undersized on Android. Back navigation diverges further — Android has a
   system gesture and button that HIG does not describe at all.
2. **One cross-platform visual and interaction language, following neither guideline** — the
   most internally consistent option and the most common in React Native apps. Rejected because
   the consistency is bought from the user's muscle memory: an app that dismisses a sheet its
   own way is a worse app on both platforms, and it is the class of thing App Store review
   comments on.
3. **Platform-divergent component primitives — two `Button`s, two sheets** — the thorough
   version. Rejected as disproportionate: the guidelines agree on nearly everything the
   primitives express, so the divergence would be almost entirely duplication, and the CVA
   primitives are the part of this codebase most worth keeping singular.
4. **Putting the rule in the workspace `ganapps/CLAUDE.md`** — where cross-cutting product
   context already lives. Rejected because there is no sibling `ganapps/AGENTS.md`, so Codex
   never sees it; the folder is not a git repo, so the team never gets it; and the file
   disclaims authority over any repo's conventions itself.

## Consequences

- Touch targets clear 48dp everywhere rather than branching, which makes iOS controls 4pt
  larger than HIG requires. Accepted: a branch per control costs more than the 4pt.
- `Button` `size="sm"` is now a documented gap rather than an accident. It stays in the API —
  it is used where the element is not a primary target — but it needs a `hitSlop` or a caller
  who knows. That is a code change this ADR does not make.
- Text scales with the system setting because React Native leaves `allowFontScaling` on and
  nothing in `src/` turns it off. Keeping that true is now a rule, and layouts are expected to
  survive enlarged text — which no current test asserts and no screen has been audited for.
  This is the consequence most likely to produce work later.
- `Platform.OS` branching will spread beyond keyboard avoidance. The affordance/ornament split
  is what keeps that from becoming a licence to fork any component on a whim.
- HIG's haptic guidance is unimplementable as written: `expo-haptics` is not installed. The
  `## Platform conventions` table deliberately omits haptics rather than stating a rule the
  codebase cannot follow. Adding the dependency is a separate decision.
- The review table gains a `Platform conventions` row, so every feature review now costs a
  little more. That is the point — a rule nothing checks is a rule that decays.
- AJ and Jezerwel's agents change behaviour in this repo the moment this lands, without having
  seen it proposed. Mobile is the only repo bound, but the team is owed the heads-up.
