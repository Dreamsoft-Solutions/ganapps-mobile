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
| `secondary` | `#1F2937` | `#1F2937` | Secondary actions, emphasis surfaces |
| `secondary-foreground` | `#FFFFFF` | `#FAFAFA` | Text on secondary surfaces |
| `muted` | `#F4F4F5` | `#27272A` | Subtle backgrounds |
| `muted-foreground` | `#6B7280` | `#A1A1AA` | Placeholder, disabled, secondary text |
| `accent` | `#F4F4F5` | `#27272A` | Hover accents, subtle emphasis |
| `accent-foreground` | `#1F2937` | `#FAFAFA` | Text on accent surfaces |
| `destructive` | `#EF4444` | `#B91C1C` | Errors, destructive actions |
| `destructive-foreground` | `#FFFFFF` | `#FAFAFA` | Text on destructive surfaces |
| `border` | `#D1D5DB` | `#27272A` | Borders, dividers |
| `input` | `#D1D5DB` | `#27272A` | Input borders |
| `ring` | `#22C55E` | `#22C55E` | Focus rings |

### Legacy tokens

The older `lynx-*` palette still exists in `tailwind.config.js` for backward
compatibility during the migration. New work must use the semantic tokens above.

## Typography

Font family: **Inter**.

| Utility | Size | Line height | Weight | Letter spacing |
|---|---|---|---|---|
| `headline-lg` | 32px | 40px | 700 | -0.02em |
| `headline-md` | 20px | 28px | 600 | — |
| `headline-sm` | 16px | 24px | 600 | — |
| `body-lg` | 16px | 24px | 400 | — |
| `body-md` | 14px | 20px | 400 | — |
| `label-md` | 12px | 16px | 600 | 0.05em |
| `label-sm` | 11px | 14px | 500 | — |

Use `font-sans` for all text. Default body color is `text-foreground`.

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
