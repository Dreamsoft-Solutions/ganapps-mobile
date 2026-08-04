# Ganapps Mobile Design System

This document defines the visual design system for the Ganapps mobile app.
It is the source of truth for colors, typography, spacing, and component
patterns. Any new UI work must follow these tokens.

## Principles

- **No hardcoded colors.** Every color must come from the Tailwind theme as a
  semantic token (`primary`, `secondary`, `muted`, etc.).
- **First-class light and dark themes.** Colors are CSS variables that swap
  under the `.dark` class. The app follows the device color scheme.
- **Compose with primitives.** Screens are built from `components/common/`
  primitives. One-off styles are avoided; prefer adding a variant.
- **No emojis.** Use `lucide-react-native` for iconography.
- **User-facing only.** This design system serves the consumer mobile app
  (finding, joining, and registering for Ganaps), not the organizer dashboard.

## Color tokens

Tokens are exposed as Tailwind utilities and backed by CSS variables in
`src/global.css`.

| Token | Light | Dark | Usage |
|---|---|---|---|
| `background` | `#FFFFFF` | `#09090B` | Screen backgrounds |
| `foreground` | `#000000` | `#FAFAFA` | Primary text |
| `card` | `#FFFFFF` | `#18181B` | Card surfaces |
| `card-foreground` | `#000000` | `#FAFAFA` | Text on cards |
| `primary` | `#22C55E` | `#22C55E` | Primary actions, active states, links |
| `primary-foreground` | `#FFFFFF` | `#FFFFFF` | Text on primary surfaces |
| `like` | `#DC2626` | `#F87171` | Selected Like icon |
| `save` | `#A16207` | `#FACC15` | Selected Save icon |
| `secondary` | `#1F2937` | `#1F2937` | Secondary actions, emphasis surfaces |
| `secondary-foreground` | `#FFFFFF` | `#FAFAFA` | Text on secondary surfaces |
| `muted` | `#F4F4F5` | `#27272A` | Subtle backgrounds |
| `muted-foreground` | `#6B7280` | `#A1A1AA` | Placeholder, disabled, secondary text |
| `accent` | `#F4F4F5` | `#27272A` | Hover accents, subtle emphasis |
| `accent-foreground` | `#1F2937` | `#FAFAFA` | Text on accent surfaces |
| `destructive` | `#EF4444` | `#B91C1C` | Errors, destructive actions |
| `destructive-foreground` | `#FFFFFF` | `#FAFAFA` | Text on destructive surfaces |
| `info` | `#DBEAFE` | `#172554` | Informational tonal badge fill |
| `info-foreground` | `#1E40AF` | `#93C5FD` | Text and icons on `info` |
| `warning` | `#FEF3C7` | `#451A03` | Time-sensitive tonal badge fill |
| `warning-foreground` | `#78350F` | `#FCD34D` | Text and icons on `warning` |
| `notice` | `#EDE9FE` | `#2E1065` | Change/notice tonal badge fill |
| `notice-foreground` | `#5B21B6` | `#C4B5FD` | Text and icons on `notice` |
| `border` | `#D1D5DB` | `#27272A` | Borders, dividers |
| `input` | `#D1D5DB` | `#27272A` | Input borders |
| `ring` | `#22C55E` | `#22C55E` | Focus rings |

### Tonal status badges

`info`, `warning`, and `notice` are **soft fills paired with a same-hue
foreground**, unlike `primary`/`destructive`, which are saturated fills with a
near-white foreground. Use them for low-emphasis status metadata — the
announcement type chips in Event Hub are the reference implementation.

Two rules keep them coherent:

- **They are not action colors.** `primary` is reserved for brand and actions,
  so a status badge must never use it; a chip that reads louder than the content
  it labels inverts the hierarchy.
- **Fill and foreground always come as a pair.** Every pairing clears WCAG AAA
  (7:1) in both themes — the lowest is light `info` at 7.15:1. Never mix a
  fill from one family with a foreground from another, and never apply an
  opacity modifier (`bg-info/10`): the variables hold hex values, so the
  modifier resolves to no background at all.

`destructive` stays the only red, so an error is never confused with a reminder.

### Category accents

Event-category tags are the one sanctioned exception to "no hardcoded colors".
They use Tailwind primitives directly — `bg-red-500`, `bg-blue-500`,
`bg-amber-500`, `bg-purple-500`, `bg-orange-500`, `bg-teal-500` — rather than
semantic roles.

Semantic roles name a *function* in the interface. A category color names a
category, and the category list is data that grows as organizers add event
types. Minting `category-social`, `category-sports`, and so on would freeze that
list into the design system and require a token change to add a category. Tags
are also decorative rather than structural: they carry no meaning a color-blind
user loses, because the label is always shown.

Google's brand colors on the login screen are the same kind of exception, for
the same reason — they are someone else's brand, not ours to re-role. That is
why `components/forms/LoginForm.tsx` keeps a literal `bg-white` on the Google
badge; it is the only one left in `src/`.

## Typography

Font family: **Inter**.

| Utility | Size | Line height | Weight | Letter spacing |
|---|---|---|---|---|
| `headline-lg` | 32px | 40px | 700 | -0.02em |
| `headline-md` | 20px | 28px | 600 | — |
| `headline-sm` | 16px | 24px | 600 | — |
| `body-xl` | 18px | 28px | 400 | — |
| `body-lg` | 16px | 24px | 400 | — |
| `body-md` | 14px | 20px | 400 | — |
| `label-md` | 12px | 16px | 600 | 0.05em |
| `label-sm` | 11px | 14px | 500 | — |

Default body color is `text-foreground`. Each size token carries its own
`fontWeight`, which is what gives headings their weight by default — Android
synthesizes it over `Inter-Regular`. Override it only when you need a weight
the size token does not provide.

React Native does not synthesize *named* families — the font family *is* the
weight, and each one is a separate file registered by the `expo-font` config
plugin in `app.config.js`:

| Utility | File | Weight |
|---|---|---|
| `font-sans` | `Inter-Regular.otf` | 400 |
| `font-inter-medium` | `Inter-Medium.otf` | 500 |
| `font-inter-semibold` | `Inter-SemiBold.otf` | 600 |
| `font-inter-bold` | `Inter-Bold.otf` | 700 |
| `font-inter-black` | `Inter-Black.otf` | 900 |

All five are Inter v4.1. Adding a weight means adding the file, listing it in
`app.config.js`, adding the token, **and** running `npx expo prebuild --clean`
plus a native rebuild — a config plugin does not take effect on a Metro reload.

`Inter-Black` is registered but is **not** in the current native build, so
`font-inter-black` falls back until someone rebuilds.

### Why `Text` drops its default family

`components/common/Text.tsx` applies `font-sans` only when the caller has not
named a family of its own. Tailwind emits `.font-sans` after every
`.font-inter-*` utility, so a default kept alongside the caller's class wins on
source order — which silently rendered every `font-inter-bold` and
`font-inter-semibold` in the app as regular, including inside `Button` and
`Avatar`. Any new text primitive that hardcodes a family owes callers the same
escape hatch.

## Spacing

| Token | Value |
|---|---|
| `base` | 4px |
| `xs` | 8px |
| `sm` | 12px |
| `md` | 16px |
| `lg` | 24px |
| `xl` | 32px |
| `margin-mobile` | 16px |
| `gutter-mobile` | 12px |

## Radii

| Token | Value |
|---|---|
| `sm` | 4px |
| `md` | 12px |
| `lg` | 16px |
| `xl` | 24px |
| `full` | 9999px |

## Shadows

The design system uses subtle shadows for elevation:

- `shadow-sm`: `0 1px 2px 0 rgb(0 0 0 / 0.05)`
- `shadow`: `0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)`
- `shadow-md`: `0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)`
- `shadow-lg`: `0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`

Add these to `tailwind.config.js` under `extend.boxShadow`.

## Component patterns

### Button

Variants: `default`, `secondary`, `outline`, `ghost`, `destructive`, `link`.
Sizes: `sm`, `md`, `lg`.

- `default`: filled `primary` with `primary-foreground` text.
- `secondary`: filled `secondary` with `secondary-foreground` text.
- `outline`: transparent with `border` and `foreground` text.
- `ghost`: transparent, hover uses `accent`.
- `destructive`: filled `destructive`.
- `link`: text-only, underlines on hover.

### Input

- Background: `background`
- Border: `input` (`border` when focused/error)
- Error border: `destructive`
- Placeholder: `muted-foreground`
- Label: `foreground`, `label-md` size, uppercase tracking

### Card

- Background: `card`
- Text: `card-foreground`
- Border: `border` (optional)
- Radius: `lg` or `xl`

### Chips

Used for selectable items such as interests.

- Unselected: `background`, `border`, `foreground` text
- Selected: `primary`, `primary-foreground` text
- Radius: `full`

### Avatar

- Default: branded placeholder with initials or `default-avatar.jpg`
- Edit overlay: `primary` circular badge with camera icon
- Size variants: `sm`, `md`, `lg`

## Dark mode

Dark mode is driven by `react-native`'s `useColorScheme` hook. A `ThemeProvider`
applies the `.dark` class to the root view. Tailwind is configured with
`darkMode: 'class'`.

Always test both themes when adding new UI.

## Brand assets

- Logo mark (square): `assets/brand/ganap-logo-1.png`
- Logo with wordmark: `assets/brand/ganap-logo-white-text.png`
- Default avatar: `assets/images/default-avatar.jpg`

## Voice and copy

The app speaks directly to attendees:

- “All the ganaps, in one app.”
- “Find what’s happening across Iloilo.”
- “Discover nearby events, join the map, and never miss a ganap.”

Keep labels action-oriented and concise. Avoid organizer/business terminology
in user-facing surfaces.
