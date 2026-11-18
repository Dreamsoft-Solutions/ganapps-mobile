# Mobile feature review reference

Read the sections relevant to the task. Code paths and command working directories in this reference are relative to the repository root unless stated otherwise.

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
- [ ] New component? → `components/common/` if shared; follow the [className rule](implementation-reference.md#the-classname-rule)
- [ ] New control or screen? → touch target, back, text scaling, safe area, and screen-reader labels checked against [Platform conventions](../DESIGN.md#platform-conventions)
- [ ] Offline write? → outbox via `db/schema.ts` + `sync.service.ts`
- [ ] Error/loading/empty states covered? → `ErrorView` with retry, `Loading`, `Empty`
- [ ] TSDoc on every new or touched export? (not linted — this one is on you)
- [ ] Explicit types on every function, callback, and parameter? (`npm run lint` will tell you)
- [ ] Test written first (hooks, utils, services, API layer)?

## Code Review Process

For application feature changes, perform a structured review of the relevant categories. Documentation-only edits require document and link checks, not application test suites.

1. **Run** `npm run check`, `npm run type-check`, and `npm run test`, and report the real output.
2. **Audit** the diff:

| Category | Checks |
|---|---|
| Best practices | TSDoc on new/touched exports? `@param`/`@returns`/`@throws` correct? No `any`? (Explicit types are gated by `npm run lint`, so step 1 already covers them.) |
| API layer | Imports `axiosInstance`, not bare `axios`? Version-free path? No second unwrap of the envelope? Route confirmed against the server? |
| Hook conventions | Endpoint in `api/endpoints/`? Query/mutation in `hooks/queries|mutations/`? Aggregated hook? Query key factory exported? |
| Navigation | Correct route group? Layout updated? Dynamic params right? Routed via `Routes`, with no route string literal anywhere? |
| Components | CVA variants over one-off styles? Named export? Tailwind only, no StyleSheet? `className` decision deliberate? |
| Platform conventions | Touch target clears 44pt and 48dp? Android back handled? `accessibilityLabel`/`accessibilityRole` present? Insets from `useSafeAreaInsets`? Layout survives enlarged system text? Reanimated animations set `ReduceMotion.System`? |
| Forms & validation | Zod schema in `utils/validation.ts`? `zodResolver`? `FormProvider` wrapping fields? |
| Auth & security | Token read via the store? 401 path intact? No secrets in source? |
| Offline & sync | Outbox insert for offline writes? Sync service handles the entity type? Cache tables updated? |
| Errors & state | Loading/error/empty covered? `parseApiError` used? |
| State management | Server state in TanStack Query, client state in Zustand? Store hydration still gated on `isHydrated`? |
| Tests | Written before the code? Cover the failure path, not just the happy one? |
| Tech debt | Dead or commented code? Oversized components? Duplicate logic? |
| Performance | N+1 queries? FlatList keys? Unbounded lists? Missing pagination? |
