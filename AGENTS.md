# Ganapps Mobile Agent Guide

The mobile app owns the native client and local SQLite data. The server owns HTTP contracts; follow the server when an API contract differs.

## Product and language

- Ganapps serves events across Iloilo City. Do not assume CPU is the only campus or that venues must be campuses; proximity is central to discovery.
- Use GLOSSARY.md for domain terms: a Ganap is an event and a Business is an organizing body.
- Use npm in this repository. Add Expo packages with npx expo install so versions match the installed SDK.

## Start with the task

Find unfamiliar features through [Feature entry points](docs/agents/implementation-reference.md#feature-entry-points). Read only the matching reference:

- New checkout or missing dependencies: [Fresh worktrees](docs/agents/implementation-reference.md#fresh-worktrees).
- API calls, response envelopes, or refresh behavior: [API Layer](docs/agents/implementation-reference.md#api-layer).
- Feature endpoints and hooks: [Module Convention](docs/agents/implementation-reference.md#module-convention).
- Screen routes: [Navigation Convention](docs/agents/implementation-reference.md#navigation-convention).
- Shared components or forms: [Component Convention](docs/agents/implementation-reference.md#component-convention).
- Styling, themes, or native props: [NativeWind & Theme](docs/agents/implementation-reference.md#nativewind--theme) and docs/DESIGN.md.
- Expo, Firebase, Mapbox, or iOS native configuration: [Known Drift](docs/agents/native-build-reference.md#known-drift--do-not-imitate) and [iOS Native Build Configuration](docs/agents/native-build-reference.md#ios-native-build-configuration).
- Feature work: [Pre-Implementation Checklist](docs/agents/review-reference.md#pre-implementation-checklist).

## Mobile boundaries

- Store tokens in SecureStore through utils/secure-storage.ts. Keep the user and auth state in memory; do not persist tokens in Zustand. Use the API layer's shared refresh and envelope handling.
- TanStack Query owns server state. Zustand owns client-only state. Keep query keys in the existing factories.
- Route screens live under src/app. Expo Router treats every file there as a route, so keep test files outside src/app.
- Keep form schemas, native maxLength, field guidance, and server validation aligned. User bios allow up to 280 characters; registration answers use the maximum from the server-provided Registration Form block.
- Use shared components/common primitives, semantic theme tokens, and lucide-react-native icons. Keep light and dark themes working. Follow docs/DESIGN.md for spacing, typography, platform behavior, and accessibility. UI copy has no emojis.
- Add TSDoc to every exported function, class, or method you create or materially change.
- Biome's explicit-type rule applies to every function and callback parameter and return value, plus non-literal module variables. Use existing TanStack Query generic patterns to preserve inference.

## CI

CI steps and Pact provider selection live in .github/workflows/ci.yml; read it before changing CI or type-check behavior. It runs npx expo customize tsconfig.json before type-checking. This creates gitignored .expo/types/; do not commit those generated types.
## Database and build safety

- Editing src/db/schema.ts is normal work. Never run Drizzle migration generation or application. If a change needs either command, give the human the exact command. Do not launch the app when it would apply a pending migration.
- Run npx expo customize tsconfig.json after a fresh checkout or route-tree change and before type-checking; it generates the gitignored route types.
- Biome check includes organize-imports assists; format alone does not.

## Verification and delivery

- Do not add unit tests; this overrides test-first guidance in docs/agents/review-reference.md. Consumer contract checks live in pact/; read [Pact contract checks](docs/agents/implementation-reference.md#pact-contract-checks) when changing them or CI.
- Read package.json and .github/workflows/ci.yml for current commands and CI behavior. For documentation-only changes, run npm run check:docs. For code review, follow [Code Review Process](docs/agents/review-reference.md#code-review-process).
- Start feature work from refreshed origin/dev, use Conventional Commits, and keep required Git hooks. Open completed changes as a PR to dev; do not merge unless asked.
