# ADR 0001: Type-Checked Route Table Using Object-Form Hrefs

**Date:** 2026-07-25
**Status:** Accepted

## Context

Expo Router derives the app's routes from the `src/app/` file tree. Navigation happens through
`router.push` / `router.replace` and `<Link href>`, which historically took route strings written
inline at each call site.

Route strings drift. Rename or move a screen and every literal pointing at it becomes wrong — and
the drift is **silent**. There is no build error, no failing test, and at runtime the tap simply
does nothing. The bug surfaces as "this button is broken," far from the rename that caused it.

The repo had already accumulated exactly that. `src/constants/routes.ts` existed but was **imported
by nothing**, and had drifted into declaring `/(auth)/verify-email` and `/(auth)/onboarding` (both
screens live at the root of `src/app/`, not in the `(auth)` group), a `forgot-password` screen that
has never existed, and a `homeDetail(id)` helper pointing at a route with no `[id]` file. Eleven
route string literals were scattered across six other files.

Expo Router ships generated types (`.expo/types/router.d.ts`) that appear to solve this. The
central question was whether they actually validate anything.

**They validate the object form only.** This was measured, not assumed:

- `expo-router` 57 takes a **bare `Href`** in `router.push`/`replace`
  (`node_modules/expo-router/build/global-state/router.d.ts:56`) and in `Link`'s `href`
  (`node_modules/expo-router/build/link/useLinkHooks.d.ts:98`). Its type parameter is never
  instantiated anywhere in the package.
- `Href<T = ExpoRouter.__routes>` therefore falls back to the generated interface's own default,
  `T = string`, so `SingleRoutePart<string>` collapses to `string`.
- A dynamic route such as `(app)/(features)/[feature-id]` then contributes a `` /${string} `` member
  to the union, which matches **any** absolute path. `router.replace('/nonsense')` compiles clean.
- The object form `{ pathname: '...' }` **is** strictly validated: the union lists object pathnames
  as exact string literals, with no catch-all member.

This distinction is easy to get backwards. An earlier investigation probed the string form by
replacing a real href with `/this-route-does-not-exist`, saw zero errors, and concluded the
generated types were dormant. That was a false negative caused by the catch-all — the types were
working fine, just not on that form.

## Decision

All navigation goes through a single table in `src/constants/routes.ts`, and **no route string
literal appears anywhere else in the codebase**.

The file exports a `RouteTable` interface whose every leaf is typed `Href`, plus a `Routes` object
typed against it. Typing the leaves is what supplies the contextual type each entry is checked
against — without the annotation there is nothing for TypeScript to validate the literal on.
Biome's `nursery/useExplicitType` independently requires the module-level annotation, so the
interface serves both purposes.

Every entry uses Expo Router's **object form**:

```typescript
app: {
  home: { pathname: '/(app)/(home)' },
},

featureDetail: (featureId: string): Href => ({
  pathname: '/(app)/(features)/[feature-id]',
  params: { 'feature-id': featureId },
}),
```

Call sites read `router.replace(Routes.app.home)` and `<Link href={Routes.auth.login}>`.

CI generates the route types before type-checking: `.github/workflows/ci.yml` runs
`npx expo customize tsconfig.json` immediately before `npm run type-check`.

Landed in `244ab12` (table and call sites) and `ae174a5` (CI generation step).

**The gate was proved in both directions.** Renaming `src/app/(app)/(profile)/settings.tsx` to
`preferences.tsx` and regenerating types produced `src/constants/routes.ts(79,22): error TS2820` at
the exact stale entry; restoring the filename went green. Pointing `onboarding` back at
`/(auth)/onboarding` also errors.

## Alternatives Considered

1. **Route string literals at call sites** — the status quo. Rejected because they validate
   nothing: the `` /${string} `` catch-all accepts any absolute path, so a stale literal compiles
   and fails silently at runtime. This is the failure mode the decision exists to remove.

2. **Rely on generated types alone, without a table** — appealing, and briefly believed to work.
   Rejected for the same reason: the protection people expect from "typed routes" applies to the
   object form, which nobody writes inline. Turning the flag on changes nothing for string hrefs.

3. **Commit the generated `.expo/types/`** — would remove CI's generation step and make validation
   work on a fresh clone. Rejected because a committed union goes stale the moment the route tree
   changes, and then validates routes against an out-of-date picture of the app. That is worse than
   no checking, because it looks like it is working.

4. **A runtime registry, or a test asserting every route resolves** — catches drift at test time
   rather than compile time, and adds machinery to maintain. The type system already does this for
   free once the object form is used.

## Consequences

- Adding a screen means adding its entry to `Routes`; deleting one means deleting the entry.
  `npm run type-check` fails at the exact stale entry otherwise.
- **Validation depends on `.expo/types/` existing.** It is gitignored and absent from a fresh
  checkout. Without it `Href` widens to `string | HrefObject` and every entry silently passes.
  Regenerate with `npx expo customize tsconfig.json` (any `npx expo start` also does it). The CI
  step must stay **before** `type-check` — moving or removing it disables the gate without any
  visible failure.
- Renaming or moving a route group requires regenerating types afterwards, or the reported error
  refers to the previous tree.
- Route groups in parentheses do not affect the URL, so a group segment belongs in an entry only
  where the framework needs it to disambiguate. The four tab groups each hold an `index.tsx` and
  would all otherwise resolve to `/`, so naming a specific tab requires its group. Root-level
  screens such as `verify-email` and `onboarding` take no group.
- **One drift scenario deliberately does not error:** moving `onboarding.tsx` into `(auth)/` keeps
  `/onboarding` valid, because a route inside a group also generates its group-elided URL. That is
  correct — the URL genuinely still resolves.
- Any top-level-elidable `[param].tsx` route reintroduces the `` /${string} `` catch-all, so the
  **string form will never be safe in this app**. Renaming or removing one dynamic route does not
  change that. The object form is unaffected.
- Dynamic routes need a function leaf returning `Href`, with `params` keyed by the exact segment
  name (`'ganap-id'`, not `ganapId`).
