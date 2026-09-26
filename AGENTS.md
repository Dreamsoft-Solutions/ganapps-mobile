# Ganapps Mobile — Agent Instructions

This file is the authoritative source for **code conventions**. Where it disagrees with the
code, that is a bug in one of them — say so rather than silently following either. Where it
disagrees with `../ganapps-server/`, **the server wins**: it owns the API contract.

## Overview

**Ganapps Mobile** is the React Native app for Ganapps, an event discovery product for
**Iloilo City**. Users browse events on a map or feed, register, join the event chat, check
in by QR, and leave feedback.

Scope went city-wide on 2026-09-05. Ganapps began as a campus app for Central Philippine
University, and CPU organizers remain the beachhead, but CPU is the first market rather than
the boundary — **never hardcode CPU as the only campus, or a campus as the only kind of
venue**. Because events are spread across a city rather than one campus, distance and
proximity are core to discovery, not decorative.

Domain vocabulary lives in `CONTEXT.md` at the repo root — read it before naming anything.
The two terms that matter most: a **Ganap** is an event (never `Event`, which collides with
DOM and React Native types), and a **Business** is an organizing body.

**Tech stack:** Expo SDK 57 · Expo Router (file-based) · React Native 0.86 · TypeScript 6 ·
NativeWind v4 (Tailwind) · TanStack Query v5 · Zustand v5 · react-hook-form · Zod v4 · Axios ·
Drizzle ORM (SQLite) · Biome · Jest · EAS Build

**Package manager:** npm. Not pnpm — do not copy install commands from the server or web repos.
Expo packages must be added with `npx expo install` so SDK-compatible versions are chosen.

---

## Commands

```bash
# Development
npx expo start                # Start Expo dev server
npx expo start --clear        # Clear metro cache then start

# Generate .expo/types (the Expo Router route union) without starting Metro.
# Gitignored, so run this after a fresh clone or route tree changes — otherwise
# `Href` widens and constants/routes.ts is validated against nothing.
npx expo customize tsconfig.json

# Build (EAS)
eas build --profile preview     # Preview build (Android APK / iOS sim)
eas build -p ios --profile testflight --auto-submit  # Internal TestFlight build, dev API
eas build --profile production  # Production build

# Lint & Format (Biome)
npm run lint                  # Lint only            (biome lint src/)
npm run lint:fix              # Lint with auto-fix   (biome lint --write src/)
npm run format                # Format only          (biome format --write src/)
npm run check                 # Lint + format + assists (biome check src/)

# Test (Jest)
npm run test                  # Run all unit tests
npm run test:watch            # Watch mode
npm run test:coverage         # With coverage

# Type Check
npm run type-check            # tsc --noEmit

# Database (Drizzle)
npm run db:generate           # Generate Drizzle migrations   — HUMAN ONLY, see below
npm run db:migrate            # Apply migrations              — HUMAN ONLY, see below
```

**Migrations are run by a human, never by an AI agent or tool.** This covers both scripts above,
and their underlying `drizzle-kit generate` / `drizzle-kit migrate` commands.

Migrations change persistent state that lives outside the working tree, so a mistake is not
recoverable with `git checkout` — applying one against the wrong database, or generating one from a
half-finished schema edit, leaves artifacts that then get committed and shared. Editing
`src/db/schema.ts` is ordinary work; turning that edit into a migration is not.

An agent that needs a migration **stops and prints the exact command**, the same way it hands over
`git commit` and `git push`. A plan step reading "run `npm run db:generate`" is a hand-off point,
not an action. The same applies to the runtime migration runner: writing the code that calls
`useMigrations` is fine, launching the app so it applies is not.

**`npm run format` alone cannot make `npm run check` pass.** `check` also runs assists
(`assist/source/organizeImports`), which `format` never applies. To clear everything:

```bash
npm run format
npx biome check --write --only=assist/source/organizeImports src/
```

`npm run reset-project` still exists in `package.json`. **Do not run it** — it moves `src/`
aside and scaffolds a blank app.

---

## Project Structure

Use this map when locating an unfamiliar feature. See [Project Structure](docs/agents/implementation-reference.md#project-structure).

## API Layer

Before changing API calls, envelopes, or refresh behavior, read this contract guidance. See [API Layer](docs/agents/implementation-reference.md#api-layer).

## Input length limits

Keep form validation, native `maxLength`, visible help, and server validation aligned. Use these existing limits; do not shorten the User bio to the example values in the DS-140 ticket.

| Field | Limit |
|---|---:|
| User first and last names | Up to 64 characters |
| Username | 3–32 characters |
| User bio | Up to 280 characters |
| Registration text answers | Use the maximum configured on the Registration Form block |

Show concise length guidance beside fields where a User could otherwise hit a validation error without warning. Dynamic Registration answers must continue using the server-provided maximum.

## Module Convention

When adding or changing feature endpoints and hooks, follow the three-layer convention. See [Module Convention](docs/agents/implementation-reference.md#module-convention).

## Navigation Convention

Before adding, moving, or linking screens, read the route-table and generated-type rules. See [Navigation Convention](docs/agents/implementation-reference.md#navigation-convention).

## Component Convention

Before changing primitives or forms, read their prop, variant, and composition rules. See [Component Convention](docs/agents/implementation-reference.md#component-convention).

## Auth & API Convention

- **Token storage** — `expo-secure-store` via `utils/secure-storage.ts`, keyed
  `ganapps_access_token`, `ganapps_refresh_token`, `ganapps_expires_at`. The `user` object is
  in-memory only.
- **Hydration** — `auth.store.ts` has **no `persist` middleware**. `hydrate()` reads
  SecureStore explicitly and is called once from the root layout; `isHydrated` gates rendering.
- **Token attachment** — the request interceptor reads `useAuthStore.getState().token` outside
  the React lifecycle.
- **Auto-refresh** — hybrid: preemptive (2 min before `expiresAt`) plus reactive 401 with a
  single shared refresh promise and a queue of waiting requests.
- **Auto-logout** — when refresh fails, the error interceptor calls `clearAuth()`.

---

## Design Rules

- **No emojis** in UI text, labels, or error messages.
- **Icons** — `lucide-react-native` for all iconography.
- **Spacing** — use the Tailwind scale in `docs/DESIGN.md` (`p-md`, `gap-lg`), not raw pixel values.
- **Platform guidelines** — iOS follows Apple's Human Interface Guidelines; Android follows
  the Android design guidelines. Both bind navigation, touch targets, text scaling, and
  accessibility. See [Platform conventions](docs/DESIGN.md#platform-conventions).

## Design System

The full design token reference, typography, spacing, and component patterns live
in `docs/DESIGN.md`. Read it before adding new UI. Key rules:

- **No hardcoded colors** — use semantic Tailwind tokens (`primary`,
  `secondary`, `muted`, `foreground`, etc.).
- **Light and dark themes are first-class** — colors are CSS variables that swap
  under NativeWind's active color scheme.
- **Compose with primitives** — screens are built from `components/common/`;
  one-off styles are avoided in favor of new variants.

---

## TSDoc Requirements

Every exported function, class, and method **must** have a TSDoc comment covering purpose,
`@param` (singular, one per parameter), `@returns`, and `@throws` where applicable. Private
helpers need one only when the logic is non-obvious.

**Current code does not comply.** Most of `components/`, `hooks/`, and `api/endpoints/`
predates enforcement. Do not retrofit the repo wholesale — add TSDoc to every export you
create, and to any export you meaningfully change.

Unlike explicit return types, TSDoc has **no Biome rule** and nothing enforces it, so this one
does depend on review. Explicit types are a hard gate — see *TypeScript Standards*.

---

## NativeWind & Theme

When changing styling or theme-dependent native props, read these token and theme rules. See [NativeWind & Theme](docs/agents/implementation-reference.md#nativewind--theme).

## TypeScript Standards

- Strict mode (extends `expo/tsconfig.base`)
- No `any` — use `unknown` plus type guards
- `const` over `let` unless mutation is required
- No unused imports or commented-out code — delete it
- `import type` for type-only imports
- Prefer derived types (`Pick`, `Omit`, `Partial`) over duplicated shapes

### Explicit types — enforced by Biome

`nursery/useExplicitType` is set to `error` in `biome.json`, so this is a build gate, not a
review convention. `npm run lint` fails on a violation, and `pre-push` runs `npm run lint`.

The rule is **broader than "exported functions"** — it has no options, and it flags:

- every function's return type, including **private helpers** and **inline callbacks**
  (`onPress`, `renderItem`, `keyExtractor`, `mutationFn`, `onSuccess`)
- every **parameter** without an annotation, even where TypeScript infers it contextually
  from a generic — Biome does not do type inference, so a contextually-typed callback
  parameter still has to be written out
- **module-level variables** that are not plain literals — `export const API_BASE_URL: string`

Practical consequences:

- Screens and layouts are `(): ReactElement`. So are components — see the `LoginForm`
  example under [Form Pattern](docs/agents/implementation-reference.md#form-pattern).
- Endpoint functions are `(dto: Dto): Promise<Payload>`, naming the **inner** payload.
- Hooks return TanStack's own result types: `UseQueryResult<T, Error>`,
  `UseMutationResult<T, Error, V>`. An aggregated hook returning an object literal needs a
  named exported interface — see `UseAuthResult` in `hooks/useAuth.ts`.
- Annotating a `queryFn`'s `pageParam` **breaks TanStack's inference of `TPageParam`**, which
  silently degrades to `unknown`. Pass explicit generics to `useInfiniteQuery` instead;
  `hooks/useFeatures.ts` shows the five-generic form.

There is no autofix. `@biomejs/biome` is pinned to an exact version rather than a caret range
because this is a **nursery** rule: a minor bump could change its behaviour and break
`pre-push` for everyone. Do not widen that range without re-running the rule across `src/`.

## File Naming

- Components: PascalCase, named exports (`Button.tsx`, `LoginForm.tsx`)
- Hooks: `use` prefix, camelCase (`useAuth.ts`)
- Utilities / services / constants / stores: kebab-case (`error-handling.ts`, `auth.store.ts`)
- API endpoints: kebab-case (`auth.ts`)
- Screens: default exports (Expo Router requirement); everything else: named exports
- Path aliases: `@/*` → `./src/*`, `@/assets/*` → `./assets/*`

---

## Error Handling

- `parseApiError()` (`utils/error-handling.ts`) extracts `message` and `errorCode` from an
  Axios error, matching the server's `GlobalExceptionFilter` shape in `api/types/api-error.ts`.
- The error interceptor parses every rejection, so components receive plain `Error` objects
  carrying an optional `errorCode`.
- `ErrorView` renders an error with an optional retry.
- Error codes mirror the server's `AppError` enum in `constants/errors.ts`; `ErrorMessages`
  maps a subset to user-facing copy.

## State Management

- **TanStack Query** for server state. Client defaults (`RootProvider`): `retry: 1`,
  `gcTime: 5 min`. Per-hook options override these.
- **Zustand** for client-only state, read inside React via `useAuthStore(s => s.token)` and
  outside it via `useAuthStore.getState()`.
- Query key factories everywhere.

## Testing

Jest with the `jest-expo` preset. Tests generally sit beside the code as `<name>.test.ts`,
except for Expo Router route tests, which live outside `src/app/` in `src/app-tests/`.

**Write the test first** for hooks, utils, validation schemas, services, and the API layer.
Screens and layouts are exempt.

### Expo Router route tree

Expo Router treats every file under `src/app/` as a route module, including files ending in
`.test.ts`, `.test.tsx`, or similar. Keep all Jest tests for route screens outside `src/app/`;
route tests can import their screen with the `@/app/...` alias from `src/app-tests/`.

Never import `@testing-library/react-native` or another test-only module from `src/app/`.
Those dependencies can import Node standard-library modules such as `console` and `util`,
which are unavailable in the native React runtime and cause Android Metro bundling to fail
through Expo Router's `require.context`.

Before bundling, this check must return no files:

```bash
rg --files src/app | rg '\.test\.'
```

The `src/app-tests/route-tree.test.ts` invariant test enforces this boundary in Jest.

Prefer a fake Axios adapter over mocking modules — it exercises the real instance and its
interceptors without a network:

```typescript
axiosInstance.defaults.adapter = async (config) => ({
  data: { success: true, statusCode: 200, data: payload, message: 'Success' },
  status: 200, statusText: 'OK', headers: {}, config,
});
```

`api-layer.test.ts` uses this to pin both the `/api/v1` URL shape and envelope unwrapping.

---

## Architecture Decisions

### Token-in-secure-store on mobile, cookies on web
React Native has no cookie concept, so mobile stores tokens in the encrypted keychain/keystore
and attaches them as a bearer header. See `../ganapps-web/docs/adr/0001-cookie-only-auth.md`.

### Central envelope unwrapping
The server wraps every response identically, so unwrapping belongs in one interceptor rather
than in every endpoint. Endpoints and hooks stay free of envelope boilerplate, and their
generics name the payload the caller actually receives.

### Expo Router file-based navigation
Auth vs app group chosen by token presence in the root layout; tabs with nested stacks;
splash held until the auth decision is made.

### Three-tier feature flags
Env override (`EXPO_PUBLIC_FEATURE_FLAG_<KEY>`) → Firebase Remote Config →
`config/feature-flags/default.json` → hook default. Singleton service initialized in the root
layout. Dev fetch interval 0; prod 5 minutes.

### Custom primitives, independent from web
Mobile uses CVA primitives; web uses shadcn/ui. Both now name the same semantic roles
(`primary`, `card`, `muted-foreground`), so the repos share a *vocabulary* without sharing a
component system. That divergence is deliberate — see
`../ganapps-web/docs/adr/0002-shadcn-ui.md`.

### Offline-first outbox
Writes go to the `outbox` table and are drained by `sync.service.ts`, 3 retries then `failed`.
`feature_cache` and `user_cache` back offline reads.

---

## Known Drift — do not imitate

When reusing scaffolded endpoints/components or changing Expo/Firebase/Mapbox configuration, check these known pitfalls. See [Known Drift — do not imitate](docs/agents/native-build-reference.md#known-drift--do-not-imitate).

## iOS Native Build Configuration

Before changing iOS build settings or diagnosing native linking, read the required configuration and its rationale. See [iOS Native Build Configuration](docs/agents/native-build-reference.md#ios-native-build-configuration).

## Pre-Implementation Checklist

For feature work, apply the checklist items relevant to the changed surface. See [Pre-Implementation Checklist](docs/agents/review-reference.md#pre-implementation-checklist).

## Git Workflow

- Branch: `dev`. `master` is not a working branch. Note that `origin/HEAD` still points at
  `master`, so anything defaulting to it — a new PR's base, for one — targets the wrong branch.
- Conventional Commits, enforced by commitlint (100 char header limit)
- `pre-commit`: lint-staged; `pre-push`: lint + test. Do not bypass with `--no-verify`
- Do not commit or push unless asked

### CI

`.github/workflows/ci.yml` runs `npm ci`, `npm run check`, **`npx expo customize tsconfig.json`**,
`npm run type-check`, and `npm run test` on every push and pull request to `dev` or `master`.
It is the same sequence `pre-push` runs locally, minus the shortcuts — `npm ci` installs
strictly from `package-lock.json` and fails on drift between it and `package.json`.

The `expo customize` step generates `.expo/types/`, which is gitignored and therefore absent
from a fresh checkout. Without it `Href` widens and the route table in `constants/routes.ts` is
checked against nothing — so that step is what makes CI's `type-check` catch route drift. It is
non-interactive and leaves `tsconfig.json` byte-identical; if that ever stops being true, the
generated `tsconfig.json` is the thing to inspect first.

Node comes from `.nvmrc` in both CI and local `nvm` shells, so bump the two together rather
than letting CI test a version nobody develops on.

---

## Code Review Process

Review feature changes against the relevant categories. Run npm run check, npm run type-check, and npm run test for application feature changes; documentation-only edits need document and link checks. Preserve required Git-hook and release checks. See [Code Review Process](docs/agents/review-reference.md#code-review-process).
