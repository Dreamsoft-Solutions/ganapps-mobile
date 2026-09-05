# Ganapps Mobile — Agent Instructions

Always read this file before taking any action in this repository.

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

```
src/
├── api/                              # Axios HTTP client layer
│   ├── axios-instance.ts             # The configured instance — always import this
│   ├── config.ts                     # API_BASE_URL (includes /api/v1)
│   ├── interceptors/
│   │   ├── request.interceptor.ts    # Bearer token + preemptive refresh (2 min before expiry)
│   │   ├── response.interceptor.ts   # Unwraps the server's response envelope
│   │   ├── error.interceptor.ts      # 401 → refresh + retry queue → clearAuth
│   │   └── refresh-token.ts          # POST /auth/refresh, deduped via shared promise
│   ├── endpoints/
│   │   ├── auth.ts                   # 8 auth calls (see API Layer below)
│   │   ├── ganaps.ts                 # Public Ganap discovery + detail
│   │   └── users.ts                  # DEAD — no such endpoint on the server
│   ├── types/
│   │   ├── api-response.ts           # ApiResponse<T>, PaginatedResponse<T>, isApiResponse
│   │   └── api-error.ts              # ApiErrorResponse
│   └── api-layer.test.ts             # URL shape + envelope unwrapping tests
├── app/                              # Expo Router file-based routing
│   ├── _layout.tsx                   # Root layout — hydrate, splash, auth vs app routing
│   ├── +not-found.tsx
│   ├── onboarding.tsx                # Root level, NOT in (auth)
│   ├── verify-email.tsx              # Root level, NOT in (auth)
│   ├── (auth)/                       # Unauthenticated group
│   │   ├── _layout.tsx
│   │   └── login.tsx                                    # Login AND register — see below
│   └── (app)/                        # Authenticated group (tab navigator)
│       ├── _layout.tsx               # Tabs: Map, My Events, Chat, Profile
│       ├── (home)/                                      # Map discovery — owns `/`
│       │   ├── {_layout,index}.tsx
│       │   ├── [ganap-id].tsx                           # Ganap detail
│       │   ├── registration/[ganap-id].tsx
│       │   ├── event-hub/[ganap-id].tsx
│       │   ├── scan/[ganap-id].tsx                      # QR check-in (expo-camera)
│       │   └── feedback/[ganap-id].tsx                  # Post-attendance form
│       ├── (ganaps)/{_layout,ganaps}.tsx                # My Events — renders JoinedGanapsList
│       ├── (chat)/{_layout,chat}.tsx                    # Chat — still a placeholder
│       └── (profile)/{_layout,profile,edit,settings,joined}.tsx
├── components/
│   ├── common/                       # UI primitives
│   │   ├── Button.tsx                # CVA variants; takes `children: string`
│   │   ├── Card.tsx                  # Accepts className (ViewProps spread)
│   │   ├── Empty.tsx                 # Centered empty state
│   │   ├── Error.tsx                 # Exports `ErrorView`, not `Error`
│   │   ├── Input.tsx                 # react-hook-form Controller wrapper
│   │   ├── Loading.tsx               # Centered ActivityIndicator
│   │   └── Text.tsx                  # Accepts className (TextProps spread)
│   ├── forms/                        # LoginForm, RegisterForm, VerifyEmailForm, OnboardingForm
│   ├── lists/                        # FeatureList.tsx
│   ├── map/                          # GanapMapPin, MapSearchBar, TagChips, SelectedGanapCard
│   └── navigation/                   # AppTabBar (custom bottom tabs)
├── constants/
│   ├── errors.ts                     # ErrorCodes + ErrorMessages, mirrors server AppError
│   ├── routes.ts                     # Href-typed route table — see Navigation Convention
│   └── theme.ts                      # Dark mode palette
├── db/                               # SQLite via Drizzle
│   ├── index.ts
│   └── schema.ts                     # outbox, feature_cache, user_cache
├── hooks/
│   ├── queries/useAuthQuery.ts
│   ├── mutations/useAuthMutation.ts
│   ├── useAuth.ts
│   ├── useFeatureFlag.ts             # useFeatureFlag / ...String / ...Number
│   └── useFeatures.ts                # DEAD — see Known Drift
├── providers/RootProvider.tsx        # GestureHandlerRootView + QueryClientProvider
├── services/
│   ├── remote-config.service.ts      # Firebase Remote Config singleton
│   └── sync.service.ts               # Offline outbox processor
├── store/auth.store.ts               # Zustand; tokens in expo-secure-store
├── types/                            # auth.types, ganap.types, user.types, feature.types
├── utils/
│   ├── error-handling.ts             # parseApiError
│   ├── formatting.ts  formatting.test.ts
│   ├── secure-storage.ts             # expo-secure-store wrapper
│   ├── storage.ts                    # AsyncStorage wrapper
│   └── validation.ts                 # Zod schemas
└── global.css
```

---

## API Layer

### Base URL

The server sets `setGlobalPrefix('api')`, enables **URI versioning**, and declares every
controller `version: '1'`. Real routes are therefore `/api/v1/<path>`.

`src/api/config.ts` owns the single `API_BASE_URL`, which already includes `/api/v1`.
**Endpoint modules hold version-free paths** (`/auth/login`). Never rebuild the base URL
inline — that duplication is what let the refresh path drift out of sync once already.

`localhost` means the device, not your machine. Use `http://10.0.2.2:3000/api/v1` on an
Android emulator, or the host's LAN IP on a physical device.

### The response envelope

The server wraps **every** response via a global `ResponseInterceptor`:

```json
{ "success": true, "statusCode": 200, "data": { }, "message": "Success" }
```

`response.interceptor.ts` unwraps this centrally, so **endpoint functions and hooks see the
inner value already**. Do not unwrap a second time; `.then((res) => res.data)` in an endpoint
yields the payload, not the envelope.

Paginated payloads nest **inside** `data` — the server returns
`data: { items: [...], pagination: { total, skip, take, pages } }`. There is no top-level
`meta`.

One place deliberately bypasses the instance and unwraps by hand with `isApiResponse`:
`refresh-token.ts` uses bare `axios` so a 401 on the refresh call cannot re-enter the error
interceptor and deadlock against its own refresh queue.

Anything else must import `axiosInstance`. A call made with bare `axios` silently returns the
raw envelope, and the resulting `undefined` surfaces far from its cause.

### Interceptor order

Registered in `axios-instance.ts`, and the order matters:

1. **request** — attaches `Authorization: Bearer <token>` from the Zustand store, refreshing
   preemptively when the token expires within 2 minutes.
2. **response (fulfilled)** — unwraps the envelope.
3. **response (rejected)** — `error.interceptor`: on 401, refreshes once, queues concurrent
   failures, retries them through `axiosInstance`, and calls `clearAuth()` if refresh fails.

Retries go through `axiosInstance` so they are unwrapped like any other response. Each retried
request carries `_retry` to prevent an infinite refresh loop.

### Endpoints that exist

`authAPI` (`api/endpoints/auth.ts`) — all live:

| Function | Route |
|---|---|
| `login` | `POST /auth/login` |
| `register` | `POST /auth/register` |
| `logout` | `POST /auth/logout` |
| `refreshToken` | `POST /auth/refresh` |
| `getMe` | `GET /auth/me` |
| `updateProfile` | `PATCH /auth/me` |
| `verifyEmail` | `POST /auth/verify-email` |
| `resendVerification` | `POST /auth/resend-verification` |
| `googleLogin` | `POST /auth/google` |

The server also exposes `POST /auth/link-google`, which mobile does not wrap yet.

Beyond auth, the server has only `ganaps`, `businesses`, and `health`. Read
`../ganapps-server/docs/flags.md` for every path — **do not infer endpoints from existing
mobile code**, which contains wrappers for routes that do not exist.

---

## Module Convention

Every feature follows a strict three-layer hook pattern, consistent with the web app.

```
Endpoints  →  Queries/Mutations  →  Aggregated Hook
(API calls)    (TanStack wrappers)    (feature hook)
```

### Layer 1: Endpoints (`api/endpoints/<domain>.ts`)

- Plain object of arrow functions, one per route
- Imports `axiosInstance` — never bare `axios`, never a re-derived base URL
- Flat `.then((res) => res.data)`; no async/await
- The response generic is the **inner** payload, because the interceptor has already unwrapped

```typescript
// api/endpoints/ganaps.ts
export const ganapsAPI = {
  getById: (ganapId: string) => axiosInstance.get<Ganap>(`/ganaps/${ganapId}`).then((res) => res.data),

  list: (params?: { skip?: number; take?: number }) =>
    axiosInstance.get<GanapPage>('/ganaps', { params }).then((res) => res.data),
};
```

### Layer 2: Queries & Mutations (`hooks/queries/`, `hooks/mutations/`)

- **Queries**: export `use<Domain>Query()` plus a query key factory (`<domain>QueryKeys`)
- **Mutations**: export `use<Domain><Action>Mutation()` per write, invalidating relevant keys
- Query defaults in these hooks: `staleTime: 5 min`, `gcTime: 10 min`, `retry: 1`
- Gate queries that need auth with `enabled: !!token`

```typescript
export const authQueryKeys = {
  all: ['auth'] as const,
  me: () => [...authQueryKeys.all, 'me'] as const,
};

export function useAuthQuery(): UseQueryResult<User, Error> {
  const token = useAuthStore((s) => s.token);

  return useQuery<User, Error>({
    queryKey: authQueryKeys.me(),
    queryFn: () => authAPI.getMe(),   // already unwrapped — no second .data
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    enabled: !!token,
  });
}
```

### Layer 3: Aggregated Hook (`hooks/use<Domain>.ts`)

Combines the query and mutations into one value, exposes derived states, and owns navigation
side effects. Paginated domains use `useInfiniteQuery` here and expose flattened `items`,
`fetchNextPage`, `hasNextPage`, and pending flags (`isCreating`, `isUpdating`, `isDeleting`).

---

## Navigation Convention

`app/_layout.tsx` hydrates the auth store from SecureStore, holds the splash screen until
`isHydrated`, then branches on `token`:

- **Token** → `(app)` tab navigator, plus `verify-email` and `onboarding` as full-screen modals
- **No token** → `(auth)` stack

`verify-email.tsx` and `onboarding.tsx` live at the **root** of `app/`, not inside `(auth)`.
They are reachable only once a token exists, because registration returns tokens immediately.

### Post-registration flow

Owned by `useAuth`, which navigates after each mutation resolves:

```
register → /verify-email → /onboarding → /(app)/(home)
login    → /(app)/(home)
logout   → /(auth)/login
```

Onboarding is now two steps, owned by `OnboardingForm`: step one persists names via
`updateProfile` before advancing; step two is optional and skippable. The redirect into
onboarding is derived from `needsOnboarding(user)` (`src/utils/onboarding.ts`), not a
device-local flag.

Nested layouts use Stack navigators with `headerBackTitle: 'Back'`. Dynamic routes use the
`[param].tsx` convention.

### Never write a route as a string literal

Navigate through `constants/routes.ts` — `router.replace(Routes.app.home)`,
`<Link href={Routes.auth.login}>` — never `router.replace('/(app)/(home)')`. Nothing in the
codebase should contain a route string outside that one file.

This is a correctness rule, not tidiness. `Routes` entries use Expo Router's **object form**
(`{ pathname: '/(app)/(home)' }`) and are typed `Href`, so they are checked against the route
union generated from the `src/app/` tree. Rename or move a screen and `npm run type-check`
fails at the exact stale entry.

**The string form is never validated in this app**, with or without generated types.
`expo-router` takes a bare `Href` in `router.push`/`replace` and `Link`'s `href`, never
instantiating its type parameter, so `SingleRoutePart<string>` collapses to `string` and the
string-form route groups collapse to `string` and swallow any absolute path.
`router.replace('/nonsense')` compiles. The object form has no such member.

Adding a screen means adding its entry to `Routes`; deleting one means deleting the entry.

### Generated route types

The route union lives in `.expo/types/router.d.ts`, which is **gitignored and not in a fresh
checkout**. Without it `Href` widens to `string | HrefObject` and every entry in `Routes`
silently passes.

Generate it with `npx expo customize tsconfig.json` (any `npx expo start` also does).
CI runs that command before `npm run type-check` — see *CI*. Do not commit the generated
types: a stale committed union would validate routes against an out-of-date tree, which is
worse than no checking because it looks like it is working.

Route groups in parentheses do not affect the URL, so include a group segment only where the
framework needs it to disambiguate. `verify-email` and `onboarding` are at the root of
`src/app/` and take no group.

Exactly one screen may own `/` — `(home)/index.tsx`, the Map tab. The other three tab groups
(`(ganaps)`, `(chat)`, `(profile)`) name their screen after their group (`(chat)/chat.tsx`),
so each owns a distinct URL. See `docs/adr/0001-type-checked-route-table.md` (DS-34): a second
`index.tsx` under a tab group reintroduces the ambiguity, and no `unstable_settings.anchor` or
`initialRouteName` declaration can override which screen the router picks for a matched URL.

---

## Component Convention

```
common/ (primitives)  →  forms/ (compositions)  →  screens (Expo Router pages)
                         lists/ (FlatList wrappers)
```

- **`common/`** — primitives, always named exports, Tailwind `className` strings only (no
  `StyleSheet.create()`). `Button` uses CVA for variants.
  - `Button`: variants `primary`/`secondary`/`danger`/`ghost`, sizes `sm`/`md`/`lg`,
    supports `loading` and `disabled`. Its label is **`children: string`** — there is no
    `title` prop. `onPress` may be async; it is wrapped in try/catch internally and errors are
    delegated to the global error interceptor.
  - `Input`: `Controller`-based, requires a `<FormProvider>` ancestor, renders inline errors.
  - `Error.tsx` exports **`ErrorView`**.
- **`forms/`** — `FormProvider` compositions built from `common/`
- **`lists/`** — FlatList wrappers handling loading/error/empty states and `onEndReached`

### The `className` rule

**Only `Text` and `Card` accept `className`**, by spreading React Native's `TextProps` /
`ViewProps`. `Button`, `Input`, `Empty`, `ErrorView`, and `Loading` have closed prop
interfaces on purpose — variants belong in CVA, not in per-call-site overrides.

When adding a primitive, decide deliberately and follow the existing split: pass-through
wrappers spread their RN props; variant-driven components stay closed. Do not add `className`
to a closed component just to reach a one-off style — add a variant instead.

### Form Pattern

```typescript
export function LoginForm(): ReactElement {
  const { login, isLoading } = useAuth();
  const methods = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function handleLogin(data: LoginFormData): Promise<void> {
    try {
      await login(data);
    } catch (_error) {
      // handled by the global error interceptor
    }
  }

  return (
    <FormProvider {...methods}>
      <Input name="email" label="Email" placeholder="Enter your email" keyboardType="email-address" />
      <Input name="password" label="Password" placeholder="Enter your password" secureTextEntry />
      <Button onPress={methods.handleSubmit(handleLogin)} loading={isLoading}>
        Login
      </Button>
    </FormProvider>
  );
}
```

---

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
- **Spacing** — use the Tailwind scale below (`p-md`, `gap-lg`), not raw pixel values.

## Design System

The full design token reference, typography, spacing, and component patterns live
in `docs/DESIGN.md`. Read it before adding new UI. Key rules:

- **No hardcoded colors** — use semantic Tailwind tokens (`primary`,
  `secondary`, `muted`, `foreground`, etc.).
- **Light and dark themes are first-class** — colors are CSS variables that swap
  under the `.dark` class.
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

Styling is NativeWind v4 utility classes via `className`. Global styles in `src/global.css`;
Metro wraps the config with `withNativeWind(config, { input: './src/global.css' })`.

### Colors

Semantic roles in `tailwind.config.js`, each mapped to a CSS variable defined light and dark
in `src/global.css`. `docs/DESIGN.md` holds the full table with both values.

| Token | Usage |
|---|---|
| `background` / `foreground` | Screen background, primary text |
| `card` / `card-foreground` | Card and sheet surfaces |
| `popover` / `popover-foreground` | Overlays |
| `primary` / `primary-foreground` | Primary actions, active states, links |
| `secondary` / `secondary-foreground` | Secondary actions, emphasis surfaces |
| `muted` / `muted-foreground` | Subtle fills; placeholder, disabled, secondary text |
| `accent` / `accent-foreground` | Subtle emphasis |
| `destructive` / `destructive-foreground` | Errors, destructive actions |
| `border`, `input`, `ring` | Borders, input borders, focus rings |

Because they are CSS variables, these swap under `.dark` automatically — never hardcode a
color. The one sanctioned exception is category-tag and third-party brand colors, which use
Tailwind primitives; `docs/DESIGN.md` explains why.

Outside a `className` — RN props like `ActivityIndicator`'s `color` or `shadowColor` — read
`Colors[theme]` from `src/constants/theme.ts`, where `theme` comes from
`useResolvedTheme()`. **Never call `useColorScheme()` directly**: it reports the device
scheme and ignores an explicit light/dark preference, desynchronising the component from the
`.dark` class `ThemeProvider` applies.

The `lynx-*` Material Design 3 palette was removed in DS-16. It was pre-Ganapps branding,
36 of its 47 tokens were dead, and its values were static hex, so nothing using it could
follow dark mode.

### Typography

| Utility | Size / Weight |
|---|---|
| `headline-lg` | 32px / 700 |
| `headline-md` | 20px / 600 |
| `headline-sm` | 16px / 600 |
| `body-xl` | 18px / 400 |
| `body-lg` | 16px / 400 |
| `body-md` | 14px / 400 |
| `label-md` | 12px / 600 |
| `label-sm` | 11px / 500 |

### Spacing & radii

Spacing: `base` 4px, `xs` 8px, `sm` 12px, `md` 16px, `lg` 24px, `xl` 32px,
`margin-mobile` 16px, `gutter-mobile` 12px.
Radii: `sm` 4px, `md` 12px, `lg` 16px, `xl` 24px, `full` 9999px.

---

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
  example under *Form Pattern*.
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

Scaffolding from the template that survives in the tree. It compiles, so it looks real.

| Item | Reality |
|---|---|
| `api/endpoints/users.ts` | There is no `/users` controller. `getMe` and `updateProfile` live on `authAPI`. |
| `Empty`'s `icon?: string` prop | Renders a string at `text-4xl`, i.e. an emoji slot, which contradicts the no-emoji rule. Use `lucide-react-native` instead. |

There is **no `(auth)/register.tsx`**. Registration is a mode toggle inside
`components/forms/LoginForm.tsx`, which swaps between `loginSchema` and `registerSchema` and
between `useAuth`'s `login` and `register`. `constants/routes.ts` therefore has no
`auth.register` entry, and adding one would fail `npm run type-check`. Earlier revisions of
this file listed the screen; it never existed.

`npx expo prebuild` needs two artifacts that are not in the repo, both downloaded from the
Firebase console for the `com.ganapps.app` apps and placed in the project root:
**`google-services.json`** (Android) and **`GoogleService-Info.plist`** (iOS).
`app.config.js` points at them via `android.googleServicesFile` and `ios.googleServicesFile`.
Both are gitignored and hold project credentials, so each developer downloads their own
rather than sharing copies.

**Both Firebase apps are registered.** Verified 2026-08-29 by reading the plist:
`BUNDLE_ID: com.ganapps.app`, `PROJECT_ID: ganapps`, `IS_SIGNIN_ENABLED: true`. Earlier
revisions of this file said the iOS app was unregistered; that was wrong.

iOS prebuild needs a third thing that is **not** yet configured: a secret Mapbox token with
`DOWNLOADS:READ` scope in `~/.netrc`. `@rnmapbox/maps` fetches the Mapbox iOS SDK from a
private registry at `pod install` time, so without it `pod install` fails and no iOS build is
possible. This is separate from `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` in `.env`, which is the
public `pk.` runtime token. Never put the secret token in `.env` — the `EXPO_PUBLIC_` prefix
bundles it into the shipped binary. Tracked as DS-88.

`npx expo prebuild -p ios --no-install` skips CocoaPods and works without the Mapbox token,
which is enough to regenerate and inspect `ios/ganappsmobile/Info.plist`.

`android.package` and `ios.bundleIdentifier` are both **`com.ganapps.app`**, matching the
Android app AJ registered in the production Firebase project (confirmed with him — it is not a
scratch project). `google-services.json` embeds this string,
so the two must stay identical character-for-character or Firebase fails at runtime with an
error that does not name the mismatch. Do not "correct" it to a `com.<company>.<app>` shape.

Changing it is cheap until the first Play Store or App Store upload — nothing is published yet,
`/android` and `/ios` are regenerated from `app.config.js` — and effectively impossible afterwards,
since the identifier is permanent on both stores and tied to the signing key.

A config-plugin entry in `app.config.js` must be a package that actually ships an `app.plugin.js`.
`@react-native-firebase/app` does; `@react-native-firebase/remote-config` does not, and listing
it made Expo load the package's runtime entry as a plugin, which threw and broke **all** config
resolution — `expo start`, `expo config`, `expo prebuild` and `expo customize` alike. Check for
`app.plugin.js` in the package root before adding a plugin here.

---

## Pre-Implementation Checklist

- [ ] New API call? → confirm the route exists in `../ganapps-server/docs/flags.md` first
- [ ] Endpoint wrapper in `api/endpoints/`, importing `axiosInstance`
- [ ] Read? → query hook in `hooks/queries/` + query key factory
- [ ] Write? → mutation hook in `hooks/mutations/` + invalidation
- [ ] Several related? → aggregated hook in `hooks/use<Domain>.ts`
- [ ] Paginated? → `useInfiniteQuery`; remember `data.items` / `data.pagination`
- [ ] Form? → Zod schema in `utils/validation.ts`, component in `components/forms/`
- [ ] New screen? → Expo Router file with the right `_layout.tsx`; protected screens go in `(app)`
- [ ] Navigating anywhere? → add/use an entry in `constants/routes.ts`; never a route string literal
- [ ] New component? → `components/common/` if shared; decide `className` per the rule above
- [ ] Offline write? → outbox via `db/schema.ts` + `sync.service.ts`
- [ ] Error/loading/empty states covered? → `ErrorView` with retry, `Loading`, `Empty`
- [ ] TSDoc on every new or touched export? (not linted — this one is on you)
- [ ] Explicit types on every function, callback, and parameter? (`npm run lint` will tell you)
- [ ] Test written first (hooks, utils, services, API layer)?

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

Every feature implementation **must** conclude with a structured review.

1. **Run** `npm run check`, `npm run type-check`, and `npm run test`, and report the real output.
2. **Audit** the diff:

| Category | Checks |
|---|---|
| Best practices | TSDoc on new/touched exports? `@param`/`@returns`/`@throws` correct? No `any`? (Explicit types are gated by `npm run lint`, so step 1 already covers them.) |
| API layer | Imports `axiosInstance`, not bare `axios`? Version-free path? No second unwrap of the envelope? Route confirmed against the server? |
| Hook conventions | Endpoint in `api/endpoints/`? Query/mutation in `hooks/queries|mutations/`? Aggregated hook? Query key factory exported? |
| Navigation | Correct route group? Layout updated? Dynamic params right? Routed via `Routes`, with no route string literal anywhere? |
| Components | CVA variants over one-off styles? Named export? Tailwind only, no StyleSheet? `className` decision deliberate? |
| Forms & validation | Zod schema in `utils/validation.ts`? `zodResolver`? `FormProvider` wrapping fields? |
| Auth & security | Token read via the store? 401 path intact? No secrets in source? |
| Offline & sync | Outbox insert for offline writes? Sync service handles the entity type? Cache tables updated? |
| Errors & state | Loading/error/empty covered? `parseApiError` used? |
| State management | Server state in TanStack Query, client state in Zustand? Store hydration still gated on `isHydrated`? |
| Tests | Written before the code? Cover the failure path, not just the happy one? |
| Tech debt | Dead or commented code? Oversized components? Duplicate logic? |
| Performance | N+1 queries? FlatList keys? Unbounded lists? Missing pagination? |
