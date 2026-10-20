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
- **No emojis outside the narrow reaction exception below.** Use `lucide-react-native` for
  iconography.
- **User-facing only.** This design system serves the consumer mobile app
  (finding, joining, and registering for Ganaps), not the organizer dashboard.

### System-native reaction glyph exception

The no-emojis rule has one narrow, system-native exception: message reactions in Event Chat
and Direct Chat, plus the separate acknowledgement reactions on eligible Event Hub
Announcements. The wire enum and glyph set are closed:

| Wire value | Glyph |
|---|---|
| `HEART` | `❤️` |
| `LAUGH` | `😂` |
| `THUMBS_UP` | `👍` |
| `SAD` | `😢` |
| `ANGRY` | `😡` |

These glyphs may appear only inside a reaction control or its count. They must not appear in
general UI copy, labels, errors, notifications, profile text, message previews, or as a
replacement for iconography. Each control exposes a word-based accessibility label and
selected state; use `lucide-react-native` for every other icon.

## Platform conventions

Ganapps ships to both stores, so UI answers to two guidelines rather than one:

- **iOS** — [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines)
- **Android** — [Android design](https://developer.android.com/design), and the [Material 3](https://m3.material.io) system it is built on

Follow the guideline belonging to the platform the code runs on. The two agree far more often
than they differ. Where they differ on an **interaction affordance** — how a screen is
dismissed, where a control sits, how big it has to be — branch on `Platform.OS`; the
`KeyboardAvoidingView` calls in `components/chat/EventChatThreadView.tsx` are the existing
shape of that branch. Where they differ only on **ornament** — corner radii, elevation,
motion curves — this design system wins, so the app still looks like itself on both.

### What the guidelines bind

| Concern | iOS | Android | How it lands here |
|---|---|---|---|
| Touch target | 44×44pt | 48×48dp | Size the control to clear both, or extend it with `hitSlop` |
| Back | Left edge-swipe plus a visible back control | System back gesture and button | Pushed screens and modals answer to both; `BackHandler` covers the Android half |
| Text scaling | Dynamic Type | Font size setting | Text scales by default — keep layouts working as it grows |
| Screen reader | VoiceOver | TalkBack | `accessibilityLabel` and `accessibilityRole` on every control, `accessibilityHint` where the result is not obvious |
| Safe area | Notch, home indicator | Display cutout, gesture bar | `useSafeAreaInsets` or `SafeAreaView`, never a hardcoded inset |
| Reduced motion | Reduce Motion | Remove animations | `ReduceMotion.System` on Reanimated entering/exiting animations, as `components/common/Toast.tsx` does |

Both guidelines are also App Store and Play review surface, so a violation is a release risk,
not only a polish one.

The reasoning behind binding both, and behind the affordance/ornament split, is in
[ADR 0005](adr/0005-platform-design-guidelines.md).

### The numeric scale is not the size you think it is

**NativeWind resolves `1rem` to 14px, not 16.** That is its own default
(`inlineRem = 14`), and `metro.config.js` does not override it. Every class on
Tailwind's default numeric scale therefore renders at 0.875x its documented value:

| Class | Tailwind says | Renders here |
|---|---|---|
| `w-12` / `h-12` | 48 | **42dp** |
| `w-11` / `h-11` | 44 | 38.5dp |
| `w-8` / `h-8` | 32 | 28dp |
| `py-3` | 12 | 10.5dp |

The named tokens in `tailwind.config.js` — `xs`, `sm`, `md`, `lg`, `xl`, `touch` — are
declared in literal px and are **not** affected. `gap-sm` really is 12dp.

**So a touch target never sizes itself from the numeric scale.** Use the `touch` token:
`w-touch`, `h-touch`, `min-w-touch`, `min-h-touch` all resolve to exactly 48dp. DS-119
shipped `w-12` believing it was 48dp; it measured 42dp on a device.

### Small variants reach the floor with slop

`Button` `size="sm"` renders about 31.5dp tall and `IconButton` `size="sm"` 28dp square.
Both mark secondary actions in dense rows where 48dp would crowd the layout, so both
reach the minimum with `hitSlop` instead of growing — 9dp and 10dp per edge. `Button`
`size="md"` cannot reach it on padding alone either, so it carries `min-h-touch`.

The arithmetic lives in `buttonSizeTargets` and `iconButtonSizeStyles` beside each
primitive. Their tests resolve it against the real Tailwind theme via
`utils/tailwind-metrics.ts` rather than recomputing the scale, so a variant that lands
under 48dp fails the suite — and so does one whose declared size stops matching the
class it ships.

Building a raw `Pressable` instead? It answers to the same floor. `hitSlop` is the tool
when the control must stay visually small, and it is counted on both edges.

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

The Google icon on the login screen intentionally uses Ganapps' `primary` token
so it follows the app's action color and theme instead of preserving Google's
official blue.

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
