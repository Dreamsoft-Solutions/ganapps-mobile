# Ganapps Mobile — Agent Instructions

Always read this file before taking any action in this repository.

## Overview

**Ganapps Mobile** is the React Native mobile app for the Ganapps event platform, built with Expo SDK 57. It provides the native mobile experience for event discovery, feature management, and user interactions.

**Tech stack:** Expo SDK 57 · Expo Router (file-based) · React Native · TypeScript 6 · NativeWind v4 (Tailwind) · TanStack Query v5 · Zustand v5 · react-hook-form · Zod v4 · Axios · Drizzle ORM (SQLite) · Biome · Jest · EAS Build

**Package manager:** npm

---

## Commands

```bash
# Development
npx expo start                # Start Expo dev server
npx expo start --clear        # Clear metro cache then start

# Build (EAS)
eas build --profile preview   # Preview build (Android APK / iOS sim)
eas build --profile production # Production build

# Lint & Format (Biome)
npm run lint                  # Lint check (biome lint src/)
npm run lint:fix              # Lint with auto-fix (biome lint --write src/)
npm run format                # Auto-format (biome format --write src/)
npm run check                 # Lint + format check (biome check src/)

# Test (Jest)
npm run test                  # Run all unit tests
npm run test:watch            # Watch mode
npm run test:coverage         # With coverage

# Type Check
npm run type-check            # tsc --noEmit

# Database (Drizzle)
npm run db:generate           # Generate Drizzle migrations
npm run db:migrate            # Apply migrations
```

---

## Project Structure

```
src/
├── api/                       # Axios HTTP client layer
│   ├── axios-instance.ts      # Axios config, base URL, timeout
│   ├── interceptors/
│   │   ├── request.interceptor.ts  # Attaches bearer token from auth store
│   │   ├── response.interceptor.ts # Pass-through
│   │   └── error.interceptor.ts    # 401 → clearAuth, parseApiError
│   ├── endpoints/             # API endpoint wrappers (one per domain)
│   │   ├── auth.ts            # login, register, logout, getMe, refreshToken
│   │   ├── features.ts        # getAll, getById, create, update, delete
│   │   └── users.ts           # getMe, updateProfile
│   └── types/
│       ├── api-response.ts    # ApiResponse<T>, PaginatedResponse<T>
│       └── api-error.ts       # ApiErrorResponse types
├── app/                       # Expo Router file-based routing
│   ├── _layout.tsx            # Root layout — conditional auth/app routing
│   ├── +not-found.tsx         # 404 screen
│   ├── (auth)/                # Unauthenticated group (login, register)
│   │   ├── _layout.tsx        # Auth stack (fade animation, no header)
│   │   ├── login.tsx
│   │   └── register.tsx
│   └── (app)/                 # Authenticated group (tab navigator)
│       ├── _layout.tsx        # Tab navigator (Home, Features, Profile, More)
│       ├── (home)/            # Home tab stack
│       │   ├── _layout.tsx
│       │   └── index.tsx
│       ├── (features)/        # Features tab stack
│       │   ├── _layout.tsx
│       │   ├── index.tsx
│       │   └── [feature-id].tsx
│       ├── (profile)/         # Profile tab stack
│       │   ├── _layout.tsx
│       │   ├── index.tsx
│       │   ├── edit.tsx
│       │   └── settings.tsx
│       └── (more)/            # More tab stack
│           ├── _layout.tsx
│           └── index.tsx
├── components/
│   ├── common/                # Reusable UI primitives (CVA-based)
│   │   ├── Button.tsx         # CVA variants: primary/secondary/danger/ghost
│   │   ├── Card.tsx           # White card with rounded-xl
│   │   ├── Empty.tsx          # Centered empty state message
│   │   ├── Error.tsx          # Error display with optional retry button
│   │   ├── Input.tsx          # react-hook-form Controller wrapper
│   │   ├── Loading.tsx        # Centered ActivityIndicator
│   │   └── Text.tsx           # Base Text wrapper (font-sans, lynx text color)
│   ├── forms/                 # Form compositions
│   │   └── LoginForm.tsx
│   └── lists/                 # List components with FlatList
│       └── FeatureList.tsx
├── constants/                 # Design tokens and route constants
│   ├── errors.ts              # Error code constants
│   ├── routes.ts              # Route path constants (type-safe)
│   └── theme.ts               # Dark mode color palette
├── db/                        # SQLite via Drizzle ORM
│   ├── index.ts               # DB instance (openDatabaseSync)
│   └── schema.ts              # Tables: outbox, feature_cache, user_cache
├── hooks/                     # TanStack Query hooks + feature hooks
│   ├── queries/               # Read hooks + query key factories
│   │   └── useAuthQuery.ts
│   ├── mutations/             # Write hooks
│   │   └── useAuthMutation.ts
│   ├── useAuth.ts             # Aggregated auth hook
│   ├── useFeatureFlag.ts      # Firebase Remote Config hooks
│   └── useFeatures.ts         # Aggregated features hook (CRUD + infinite query)
├── providers/
│   └── RootProvider.tsx       # GestureHandlerRootView + QueryClientProvider
├── services/
│   ├── remote-config.service.ts # Firebase Remote Config singleton
│   └── sync.service.ts        # Offline outbox sync processor
├── store/
│   └── auth.store.ts          # Zustand auth store (tokens in expo-secure-store)
├── types/                     # Shared TypeScript types
│   ├── auth.types.ts
│   ├── feature.types.ts
│   ├── user.types.ts
│   └── firebase-remote-config.d.ts
├── utils/
│   ├── error-handling.ts      # parseApiError helper
│   ├── formatting.ts          # Date formatting (formatDate, formatDateTime)
│   ├── secure-storage.ts      # expo-secure-store wrapper (encrypted token storage)
│   ├── storage.ts             # AsyncStorage wrapper for non-sensitive data
│   └── validation.ts          # Zod schemas (login, register, createFeature)
└── global.css                 # Tailwind input (@tailwind base/components/utilities)
```

---

## Module Convention

Every feature follows a strict three-layer hook pattern, consistent with the web app.

### Three-Layer Hook Pattern

```
Endpoints  →  Queries/Mutations  →  Aggregated Hook
(API calls)    (TanStack wrappers)    (feature hook)
```

#### Layer 1: Endpoints (`api/endpoints/<domain>.ts`)

- Plain object with arrow functions, one per API route
- Calls `apiClient.<method>()` and unwraps with `.then(r => r.data)`
- No async/await — flat `.then()` unwrapping
- Fully typed with response generics (`ApiResponse<T>`, `PaginatedResponse<T>`)

```typescript
// api/endpoints/auth.ts
export const authAPI = {
  login: (data: LoginRequestDto) =>
    apiClient.post<ApiResponse<AuthResponseDto>>('/auth/login', data).then(r => r.data),
  getMe: () =>
    apiClient.get<ApiResponse<User>>('/auth/me').then(r => r.data),
};
```

#### Layer 2: Queries & Mutations (`hooks/queries/`, `hooks/mutations/`)

- **Queries**: Export `use<Domain>Query()` + a query key factory (`<domain>QueryKeys`)
- **Mutations**: Export `use<Domain><Action>Mutation()` per write operation
- Mutations invalidate the relevant query keys on success
- Query defaults: `staleTime: 5min`, `gcTime: 10min`, `retry: 1`
- Mutations use `retry: 0`

```typescript
// hooks/queries/useAuthQuery.ts
export const authQueryKeys = {
  all: ['auth'] as const,
  me: () => ['auth', 'me'] as const,
};

export function useAuthQuery(): UseQueryResult<User> {
  return useQuery<User, Error>({
    queryKey: authQueryKeys.me(),
    queryFn: () => authAPI.getMe().then(r => r.data),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });
}
```

```typescript
// hooks/mutations/useAuthMutation.ts
export function useLoginMutation(): UseMutationResult<..., Error, LoginRequestDto> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: LoginRequestDto) => authAPI.login(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authQueryKeys.all });
    },
  });
}
```

#### Layer 3: Aggregated Hook (`hooks/use<Domain>.ts`)

- Combines query + all mutations into a single return value
- Exposes `isLoading`, `error`, `isAuthenticated`/`isPending` derived states
- Handles navigation side effects where needed

```typescript
// hooks/useAuth.ts
export function useAuth(): {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: Error | null;
  login: (data: LoginRequestDto) => Promise<void>;
  register: (data: RegisterRequestDto) => Promise<void>;
  logout: () => Promise<void>;
} {
  const { data: user, isLoading, error } = useAuthQuery();
  const { loginMutation, registerMutation, logoutMutation } = useAuthMutations();
  const token = useAuthStore(s => s.token);
  return {
    user: user ?? null,
    token,
    isLoading,
    isAuthenticated: !!token && !!user,
    error,
    login: (data) => loginMutation.mutateAsync(data).then(() => {}),
    register: (data) => registerMutation.mutateAsync(data).then(() => {}),
    logout: () => logoutMutation.mutateAsync(),
  };
}
```

For features with paginated lists, aggregator hooks use `useInfiniteQuery` and expose `items` (flattened pages), `fetchNextPage`, `hasNextPage`, plus create/update/delete mutations with pending states (`isCreating`, `isUpdating`, `isDeleting`).

### Navigation Convention

Root `_layout.tsx` conditionally renders `(auth)` or `(app)` group based on `useAuthStore.token`:

- Token exists → `(app)` tab navigator with 4 tabs: Home, Features, Profile, More
- No token → `(auth)` stack navigator: login → register

Nested layouts use Stack navigators with `headerBackTitle: 'Back'`. Dynamic routes follow the `[param].tsx` Expo Router convention.

Route paths are centralized in `constants/routes.ts` as a const object with helper functions for dynamic routes (e.g., `featureDetail(id)` → `'/(app)/(features)/${id}'`).

### Component Convention

```
common/ (CVA primitives)  →  forms/ (compositions)  →  screens (Expo Router pages)
                            lists/ (FlatList wrappers)
```

- **`common/`** — Reusable UI primitives using `class-variance-authority` (CVA) for variants. Always named exports. Accept `className` for Tailwind overrides.
  - `Button`: variants `primary`/`secondary`/`danger`/`ghost`, sizes `sm`/`md`/`lg`, supports `loading` + `disabled`
  - `Input`: react-hook-form `Controller`-based, expects `<FormProvider>` parent, shows inline error messages
  - All use Tailwind `className` strings — no inline `StyleSheet.create()`
- **`forms/`** — Composed form components using `FormProvider` from react-hook-form + common components
- **`lists/`** — FlatList wrappers that handle loading/error/empty states, infinite scroll via `onEndReached`

### Form Pattern

Every form follows this structure:

```typescript
export function LoginForm(): ReactElement {
  const { login } = useAuth();
  const methods = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function handleLogin(data: LoginFormData): Promise<void> {
    try {
      await login(data);
    } catch (_error) {
      // handled by global error interceptor
    }
  }

  return (
    <FormProvider {...methods}>
      <Input name="email" label="Email" placeholder="Enter your email" />
      <Input name="password" label="Password" placeholder="Enter your password" secureTextEntry />
      <Button title="Login" onPress={methods.handleSubmit(handleLogin)} loading={isLoading} />
    </FormProvider>
  );
}
```

### Auth & API Convention

- **Token storage**: `auth.store.ts` uses `expo-secure-store` for encrypted token persistence. `accessToken` and `refreshToken` stored in SecureStore; non-sensitive state (`user`, `expiresAt`) kept in-memory or AsyncStorage.
- **Token attachment**: Request interceptor reads `useAuthStore.getState().token` directly (outside React lifecycle)
- **Auto-refresh**: Hybrid strategy — preemptive refresh 2 min before token expiry via `expiresAt` timestamp, plus reactive 401 queue with single refresh + retry. Refresh calls `POST /auth/refresh` with the stored refresh token.
- **Auto-logout**: Error interceptor catches 401 (after refresh fails) → calls `useAuthStore.getState().clearAuth()`
- **Conditional routing**: Root layout reads `useAuthStore.token` to decide auth vs app navigation
- **Axios instance** (`api/axios-instance.ts`): `baseURL` from `EXPO_PUBLIC_API_URL` env (default `http://localhost:3000/api`), 30s timeout, JSON content type

---

## Design Rules

- **No emojis** in UI text, labels, or error messages. Use icons instead.
- **Icons**: Use `lucide-react-native` for all iconography. Import from `lucide-react-native` (e.g., `import { Mail, Lock, User as UserIcon } from 'lucide-react-native'`).
- **Spacing**: Follow the spacing scale defined in `constants/theme.ts` via Tailwind classes (`p-md`, `gap-lg`, etc.).

---

## TSDoc Requirements

Every exported function, class, and method **must** have a TSDoc comment:

```typescript
/**
 * Fetches a paginated list of features.
 *
 * @param pageParams - Cursor/offset for pagination
 * @returns Paginated response with feature items and pagination metadata
 * @throws {ApiError} When the request fails or token is invalid
 */
```

- **Purpose** — what it does in one sentence
- **`@param`** — one per parameter (use `@param`, not `@params`)
- **`@returns`** — what is returned
- **`@throws`** — any expected exceptions

Private/internal helpers do not require TSDoc unless the logic is non-obvious.

---

## NativeWind & Theme

### Tailwind / NativeWind

- Styling uses NativeWind v4 with Tailwind CSS utility classes via `className` on all components
- Global styles in `src/global.css` (`@tailwind base/components/utilities`)
- Metro config wraps default config with `withNativeWind(config, { input: './src/global.css' })`

### Lynx Color System

The app uses a custom "Lynx" color palette defined in `tailwind.config.js` (Material Design 3-style):

| Token | Light Value | Usage |
|---|---|---|
| `lynx-primary` | `#006e2a` | Primary actions, active states |
| `lynx-primary-container` | `#00c853` | Primary backgrounds, highlights |
| `lynx-secondary` | `#5e5e5e` | Secondary text, subdued elements |
| `lynx-tertiary` | `#9d4139` | Tertiary accents |
| `lynx-error` | `#ba1a1a` | Error states, validation messages |
| `lynx-background` | `#f9f9f9` | Screen backgrounds |
| `lynx-surface` | `#eeeeee` | Card/surface backgrounds |
| `lynx-outline` | `#6c7b6a` | Borders, dividers |

Dark mode palette is defined separately in `src/constants/theme.ts` as a dark color object.

### Typography

Custom font size utilities defined in `tailwind.config.js`:

| Utility | Size/Weight | Usage |
|---|---|---|
| `headline-lg` | 32px / 700 | Page titles |
| `headline-md` | 20px / 600 | Section headers |
| `headline-sm` | 16px / 600 | Card titles |
| `body-lg` | 16px / 400 | Body text |
| `body-md` | 14px / 400 | Secondary text |
| `label-md` | 12px / 600 | Labels |
| `label-sm` | 11px / 500 | Captions |

### Spacing

Custom spacing scale: `base` (4px), `xs` (8px), `sm` (12px), `md` (16px), `lg` (24px), `xl` (32px), `margin-mobile` (16px), `gutter-mobile` (12px). Border radii: `sm` (4px), `md` (12px), `lg` (16px), `xl` (24px), `full` (9999px).

---

## TypeScript Standards

- Strict mode enabled (extends `expo/tsconfig.base`)
- No `any` — use `unknown` + type guards
- Explicit return types on all exported functions
- `const` over `let` unless mutation is required
- No unused imports or commented-out code — delete it
- Prefer `type` for type-only imports (`import type { User } from ...`)
- Prefer derived types (`Pick`, `Omit`, `Partial`) over duplicated shapes

## File Naming

- Components: PascalCase named exports (`Button.tsx`, `LoginForm.tsx`)
- Hooks: `use` prefix, camelCase (`useAuth.ts`, `useFeatures.ts`)
- Utilities/Services/Constants: kebab-case (`error-handling.ts`, `auth.store.ts`, `remote-config.service.ts`)
- API endpoints: kebab-case (`auth.ts`, `features.ts`)
- Screens/Pages: default exports (Expo Router convention); all other files: named exports
- Stores: kebab-case with `.store.ts` suffix (`auth.store.ts`)
- Path aliases: `@/*` → `./src/*`, `@/assets/*` → `./assets/*`

## Error Handling

- `parseApiError()` in `utils/error-handling.ts` — extracts `message` + `errorCode` from Axios errors
- Error interceptor (`api/interceptors/error.interceptor.ts`) — catches 401 → `clearAuth()`, parses all errors
- `ErrorView` component (`components/common/Error.tsx`) — displays error with optional "Try Again" button
- Button's `onPress` wrapped in try/catch (errors delegated to global interceptor)
- Error codes from server's AppError enum, mirrored in `constants/errors.ts`

## State Management

- **TanStack Query** for server state (queries, mutations, cache invalidation)
- **Zustand** for client-only state (auth tokens, UI toggles)
  - Auth tokens stored in `expo-secure-store` (encrypted keychain/keystore)
  - `accessToken` and `refreshToken` persisted via `expo-secure-store`; `user` is in-memory only
  - Store accessed both inside React (via hook `useAuthStore(s => s.token)`) and outside React (via `useAuthStore.getState()` in interceptors/services)
- Query key factory pattern used consistently across all domains
- `QueryClient` defaults: `retry: 1`, `gcTime: 5 minutes`

---

## Architecture Decisions

### Cookie-only auth on web, token-in-secure-store on mobile
- Mobile stores tokens in `expo-secure-store` (encrypted device keychain/keystore) — not `httpOnly` cookies, because React Native has no cookie concept
- Axios request interceptor reads token from Zustand store and attaches as `Authorization: Bearer` header
- Hybrid auto-refresh: preemptive + reactive 401 queue
- Error interceptor catches 401 responses (after refresh fails) and calls `clearAuth()` to force logout
- Root layout reads token to conditionally render auth vs app navigation

### Expo Router file-based navigation
- Auth group (`(auth)`) vs App group (`(app)`) determined by token presence in root layout
- Tab navigator with 4 tabs, each with nested Stack for drill-down screens
- Dynamic routes use `[param].tsx` convention
- Splash screen stays hidden until auth decision is made

### Three-tier feature flags
- Env override (`EXPO_PUBLIC_FEATURE_FLAG_<KEY>`) → Firebase Remote Config → `config/feature-flags/default.json` → hook default parameter
- Singleton `remoteConfigService` initialized in root layout
- Three hooks: `useFeatureFlag` (boolean), `useFeatureFlagString`, `useFeatureFlagNumber`
- Dev mode: minimum fetch interval 0; prod: 5 minutes

### Custom CVA primitives (independent from web)
- Mobile uses custom `components/common/` primitives with `class-variance-authority`
- Independent from web's shadcn/ui component system
- Both use Tailwind, but web uses CSS variables (`globals.css`) while mobile uses `tailwind.config.js` tokens

### Offline-first with outbox pattern
- SQLite via expo-sqlite + Drizzle ORM for local persistence
- Outbox pattern for offline writes: enqueued in `outbox` table, processed by `sync.service.ts`
- Retry limit: 3 attempts per item, then marked as `failed`
- Local cache tables (`feature_cache`, `user_cache`) for offline reads

### NativeWind v4 for styling
- All styling via Tailwind `className` — no inline `StyleSheet.create()`
- Metro config wraps default config with `withNativeWind`
- Color tokens via design system (prefix `lynx-*`)
- Components accept optional `className` prop for Tailwind overrides

---

## Pre-Implementation Checklist

Before writing code, validate:

- [ ] New API call? → define endpoint in `api/endpoints/`
- [ ] Read operation? → create query hook in `hooks/queries/` + query key factory
- [ ] Write operation? → create mutation hook in `hooks/mutations/` + query invalidation
- [ ] Multiple related queries+mutations? → create aggregated hook in `hooks/use<Domain>.ts`
- [ ] Paginated list? → use `useInfiniteQuery` in the aggregator hook
- [ ] Form needed? → zod schema in `utils/validation.ts`, form component in `components/forms/`
- [ ] New screen? → Expo Router file in `app/` with appropriate `_layout.tsx`
- [ ] Protected screen? → must be inside `(app)` group (token-based conditional routing)
- [ ] New component? → place in `components/common/` (shared) or feature-specific directory
- [ ] Offline write? → use outbox pattern via `db/schema.ts` + `sync.service.ts`
- [ ] Local read? → check `db/schema.ts` for existing cache tables
- [ ] Feature flag needed? → add default in `config/feature-flags/default.json`, use `useFeatureFlag` hook
- [ ] Error state? → `ErrorView` component with retry; loading state via `Loading` component
- [ ] Empty state? → `Empty` component with descriptive message
- [ ] Typed error path? → `parseApiError()` + typed error codes
- [ ] Function doing too much? → split

## Git Workflow

- Conventional Commits enforced via commitlint (100 char header limit)
- `pre-commit`: lint-staged (Biome check + format on staged files)
- `pre-push`: lint + test (no build)

---

## Code Review Process

Every feature implementation **must** conclude with a structured code review:

1. **Run** `npm run check` (Biome lint + format), `npm run type-check` (TypeScript), and `npm run test` (Jest)
2. **Audit** the diff against these categories:

| Category | Checks |
|---|---|
| Best practices | TSDoc on all exports? `@param`/`@returns`/`@throws` correct? No `any`? Explicit return types? |
| Hook conventions | Endpoint in `api/endpoints/`? Query/mutation in `hooks/queries|mutations/`? Aggregated hook? Query key factory exported? |
| Navigation | Screen in correct route group? Layout updated? Dynamic route params correct? Route path in `constants/routes.ts`? |
| Components | CVA variants correct? `className` prop accepted? Named export? Tailwind-only styling (no StyleSheet)? |
| Forms & validation | Zod schema in `utils/validation.ts`? `zodResolver` in `useForm`? `FormProvider` wrapping fields? |
| Auth & security | Token access via store (not hardcoded)? 401 handling correct? Conditional routing working? |
| Offline & sync | Outbox insert for offline writes? Sync service handles new entity type? Cache tables updated? |
| Errors & state | Loading/error/empty states covered? ErrorView with retry? parseApiError used? |
| State management | Server state in TanStack Query? Client state in Zustand? Token persistence via partialize? |
| Tech debt | Dead/commented code? Overly large components? Missing error paths? Duplicate logic? |
| Performance | N+1 queries? FlatList with proper keys? Unbounded lists? Missing pagination? |
