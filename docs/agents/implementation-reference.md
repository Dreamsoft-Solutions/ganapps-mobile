# Mobile implementation reference

Read the sections relevant to the task. Code paths and command working directories in this reference are relative to the repository root unless stated otherwise.

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
│   │   └── login.tsx                                    # Login AND register — see native-build-reference.md
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
For the documented CI sequence, see [CI](../../AGENTS.md#ci). Do not commit the generated
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

Because they are CSS variables, these swap under NativeWind's active color scheme — never
hardcode a color. The one sanctioned exception is category-tag and third-party brand colors, which use
Tailwind primitives; `docs/DESIGN.md` explains why.

Outside a `className` — RN props like `ActivityIndicator`'s `color` or `shadowColor` — read
`Colors[theme]` from `src/constants/theme.ts`, where `theme` comes from
`useResolvedTheme()`. **Never call `useColorScheme()` directly**: it reports the device
scheme and ignores an explicit light/dark preference, desynchronising the component from the
NativeWind color scheme that `ThemeProvider` controls.

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
