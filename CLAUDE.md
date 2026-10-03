@AGENTS.md
## Agent skills

### Issue tracker

Issues and specs live in Jira project `DS`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default labels `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Domain vocabulary lives in a single glossary at root `CONTEXT.md`; architecture decisions live in `docs/adr/`. Use the glossary's terms when naming things. See `docs/agents/domain.md`.

# Working in this repo with Claude Code

`AGENTS.md` above is authoritative for **code conventions** — commands, project structure,
the three-layer hook pattern, component and form patterns, semantic design tokens, TSDoc, TypeScript
standards, error handling, state management, and architecture decisions. Follow it. This
section covers only what it does not: how to work here, and where things go.

## The three repos

Ganapps has three repos, siblings under the parent `ganapps/` folder:

- **`ganapps-mobile/`** (this one) — Mark's. Expo SDK 57, npm.
- **`ganapps-server/`** — NestJS 11 + Prisma 7 + PostgreSQL, pnpm. Source of truth for the
  API contract and auth.
- **`ganapps-web/`** — Next.js 16 + shadcn/ui, pnpm.

Two other developers own server and web. **Never edit a sibling repo** — if a change here
needs a server endpoint or a shared type that doesn't exist yet, stop and say so; that's a
conversation with another developer, not a code change. Reading them for the API contract
is fine and encouraged.

Mobile and web intentionally diverge on components (CVA + semantic tokens vs shadcn/ui + CSS
variables) and auth (secure-store tokens vs cookies). Don't "fix" that inconsistency.

### Reading the API contract

Before writing an endpoint wrapper, hook, or type against the server, read the source
rather than inferring the shape from existing mobile code:

| Path | Use it for |
|---|---|
| `../ganapps-server/prisma/schema.prisma` | The authoritative data model — fields, relations, enums, status lifecycles |
| `../ganapps-server/src/modules/<domain>/` | Controller paths, DTO request/response shapes, authorization and service behavior |
| `../ganapps-server/docs/flags.md` | Feature-gated paths and server-side defaults |
| `../ganapps-server/docs/features/ganap-management-summary.md` | Ganap lifecycle, announcements, form blocks, QR hash |
| `../ganapps-server/docs/features/business-registration-summary.md` | Invites, org setup, membership, subscriptions, image upload |
| `../ganapps-web/docs/adr/0001-cookie-only-auth.md` | Why mobile's token handling differs from web's |

For workspace ownership, use the optional `../AGENTS.md` in the normal sibling checkout; this repository’s [feature map and worktree setup](docs/agents/implementation-reference.md#feature-entry-points) work in standalone clones too. In a ticket worktree, resolve sibling source against the assigned checkout rather than assuming these `../` paths exist. A flag being `true` in `flags.md` is the server-side default, separate from mobile’s three-tier flag resolution.

## Where documents go

| Kind of document | Location | Committed? |
|---|---|---|
| Domain glossary — the words this repo uses for its concepts | `CONTEXT.md` (repo root) | Yes — shared with the team |
| Architecture decision records | `docs/adr/NNNN-slug.md` | Yes — shared with the team |
| Feature documentation | `docs/features/` | Yes — shared with the team |
| Design specs, implementation plans, handoffs, scratch notes | `../.claude/` | No — personal |

Write ADRs when a decision is non-obvious, hard to reverse, or a teammate would otherwise
undo it. Follow the format already used in `ganapps-web/docs/adr/`: Context → Decision →
Alternatives Considered → Consequences, with `**Date:**` and `**Status:**` at the top.
Number sequentially; see `docs/adr/README.md`.

Session working material goes to the parent `../.claude/` folder, never into this repo.
See `../.claude/README.md` for naming.

## Design system

The mobile app uses the semantic token system documented in `docs/DESIGN.md`.
New UI must use those tokens (`primary`, `secondary`, `muted`, etc.) rather than
hardcoded colors, and must account for both light and dark themes. Read
`docs/DESIGN.md` before building any screen or component.

## Session workflow

- **Building something new** → resolve routine design choices from the brief and existing conventions, then implement and verify. Ask for agreement when an unresolved choice materially changes scope, the user flow, or the public contract.
- **Fixing a bug** → find the root cause before proposing a fix. No speculative patches.
- **Implementing** → write the test first where the code is testable (hooks, utils,
  validation schemas, services). Screens and layouts are exempt.
- **Long tasks** → when context is running out mid-task, write a handoff to
  `../.claude/handoffs/` before it's too late to write a good one.

## Verification before claiming done

Follow the verification scope in AGENTS.md's Code Review Process. Report the checks actually run and any failures or limits. Run the full application checks for feature changes and preserve required Git-hook and release checks; documentation-only edits require document and link checks.

## Boundaries

- **Branch:** work happens on `dev`. `master` is not a working branch.
- **Commits:** Conventional Commits, enforced by commitlint (100 char header limit).
  `pre-commit` runs lint-staged; `pre-push` runs lint + test. Don't bypass hooks with
  `--no-verify`.
- **Don't commit or push unless asked.**
- **Never run migrations.** `npm run db:generate` and `npm run db:migrate` are Mark's, like
  `git commit` and `git push`. Editing `src/db/schema.ts` is normal work; turning that edit
  into a migration is not — stop and print the command. Migrations touch state that lives
  outside the working tree, so a mistake can't be undone with `git checkout`. `AGENTS.md`
  covers this under *Commands*.
- **Never edit:** `/ios` and `/android` (generated by prebuild), `package-lock.json` by
  hand, `.env` (only `.env.example` is tracked).
- **Dependencies:** this repo uses **npm**, not pnpm — don't copy install commands from the
  server or web repos. Expo packages must be added with `npx expo install`, not `npm
  install`, so SDK-compatible versions are picked.
- **Secrets** never go in source, ADRs, or committed docs. Client-visible config uses the
  `EXPO_PUBLIC_` prefix and is therefore not secret — treat it accordingly.
