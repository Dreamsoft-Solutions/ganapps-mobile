# Ganapps Mobile Design System

This document defines the visual design system for the Ganapps mobile app, called
**Ganapps Glass**. It is the source of truth for colors, typography, spacing, glass, and
component patterns. Any new UI work must follow these tokens.

The token values live in `docs/design/tokens.json`. `src/global.css`, `src/constants/theme.ts`
and `tailwind.config.js` carry the same values by hand, and `npm run check:tokens` fails when
they drift apart. This document names every token and says what it is for. When it and `tokens.json`
disagree, `tokens.json` wins and this document is the bug.

## Principles

- **Glass floats, content is solid.** Glass is for controls that float over content: the tab
  bar, map search, chips, map buttons, top-bar actions, the action bar, the composer, toasts
  and sheet handles. Lists, cards, chat bubbles, forms and body copy are solid. Never put glass
  on glass. The one exception is the lens inside a glass segment.
- **Decide by layer, never by screen.** If it holds something a person reads or acts on, it is
  solid. If it is a control floating over content, it is glass. If it is pressed and does not
  float, it is a capsule.
- **Green means the action or the place.** `primary` is the one main action in a view. The map
  is the hero, and glass lets it show through.
- **Legible over the busiest street.** Glass that carries text uses `glass-fill-strong` with
  `foreground`, `primary-text` or `on-glass-muted`. Reduce Transparency, Increase Contrast and
  Android fall back to `glass-fill-solid`.
- **Light first, then glass.** Glass needs light behind it. Screens without a map get a `Lobe`
  of `glow` behind their glass.
- **No hardcoded colors.** Every color must come from the Tailwind theme as a semantic token
  (`primary`, `secondary`, `muted`, etc.).
- **First-class light and dark themes.** Colors are CSS variables that swap under the `.dark`
  class. The user picks Light, Dark or System in Settings.
- **Compose with primitives.** Screens are built from `components/common/` primitives.
  One-off styles are avoided; prefer adding a variant.
- **No emojis outside the narrow reaction exception below.** Use `lucide-react-native` for
  iconography.
- **User-facing only.** This design system serves the consumer mobile app (finding, joining,
  and registering for Ganaps), not the organizer dashboard.
- **Made for Iloilo.** The dark ground is the navy of the Ganapps logo. The map is Iloilo.

### System-native reaction glyph exception

The no-emojis rule has one narrow, system-native exception: message reactions in Event Chat
and Direct Chat, plus the separate acknowledgement reactions on eligible Event Hub
Announcements. The wire enum and glyph set are closed:

| Wire value  | Glyph |
| ----------- | ----- |
| `HEART`     | `❤️`  |
| `LAUGH`     | `😂`  |
| `THUMBS_UP` | `👍`  |
| `SAD`       | `😢`  |
| `ANGRY`     | `😡`  |

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

| Concern        | iOS                                         | Android                        | How it lands here                                                                                                  |
| -------------- | ------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Touch target   | 44×44pt                                     | 48×48dp                        | Size the control to clear both, or extend it with `hitSlop`                                                        |
| Back           | Left edge-swipe plus a visible back control | System back gesture and button | Pushed screens and modals answer to both; `BackHandler` covers the Android half                                    |
| Text scaling   | Dynamic Type                                | Font size setting              | Text scales by default — keep layouts working as it grows                                                          |
| Screen reader  | VoiceOver                                   | TalkBack                       | `accessibilityLabel` and `accessibilityRole` on every control, `accessibilityHint` where the result is not obvious |
| Safe area      | Notch, home indicator                       | Display cutout, gesture bar    | `useSafeAreaInsets` or `SafeAreaView`, never a hardcoded inset — see [Safe areas in modals](#safe-areas-in-modals) |
| Reduced motion | Reduce Motion                               | Remove animations              | `ReduceMotion.System` on Reanimated entering/exiting animations, as `components/common/Toast.tsx` does             |

Both guidelines are also App Store and Play review surface, so a violation is a release risk,
not only a polish one.

### Safe areas in modals

Inside a full-screen React Native `Modal`, or a route presented as `fullScreenModal`, pad the
root view with `useSafeAreaInsets()` instead of wrapping it in `SafeAreaView`. Those surfaces
sit outside the native view tree of the root `SafeAreaProvider`, so `SafeAreaView` measures its
own insets once, when it attaches mid-presentation, and keeps 0. The header then renders under
the status bar, where its close button cannot be tapped. `useSafeAreaInsets()` reads the
window insets from React context and is unaffected. `GanapShareModal` and `onboarding.tsx`
show the pattern.

A bottom sheet in a transparent `Modal` pads its last row with `insets.bottom` so actions clear
the home indicator. The tab bar is a floating island over the content, not a docked bar, so it
reserves nothing: it sits `island-inset` above the bottom inset, and every screen it floats
over pads its scroll content by `useTabBarInsets().contentClearance` (`tabbar-clearance` plus
`insets.bottom`, plus the connection banner while it floats above the island). Something pinned
to the bottom of such a screen rests above the dock; `useTabBarInsets().dockTop` gives its top
edge, and `getTabBarIslandTop(insets.bottom)` in `AppTabBar.tsx` the island's alone. The island hides on full-screen flows
(`shouldHideAppTabBar`: every Ganap screen, chat threads, friend profile and settings), and
those screens pad their own bottom bars by `insets.bottom`.

An opaque full-screen `Modal` also sets `presentationStyle="overFullScreen"`. React Native
hears about light and dark mode changes only through the app's root view, and iOS takes that
view out of the window while a `fullScreen` modal covers it. A theme change made while such a
modal is open then reaches the app only after the modal closes, so the modal stays in the old
theme. With `overFullScreen` the root view stays in the window and the modal follows the
change. Add `accessibilityViewIsModal` so VoiceOver ignores the screen underneath.

The reasoning behind binding both, and behind the affordance/ornament split, is in
[ADR 0005](https://github.com/Dreamsoft-Solutions/ganapps-home/blob/master/docs/adr/mobile/0005-platform-design-guidelines.md).

### The numeric scale is not the size you think it is

**NativeWind resolves `1rem` to 14px, not 16.** That is its own default
(`inlineRem = 14`), and `metro.config.js` does not override it. Every class on
Tailwind's default numeric scale therefore renders at 0.875x its documented value:

| Class           | Tailwind says | Renders here |
| --------------- | ------------- | ------------ |
| `w-12` / `h-12` | 48            | **42dp**     |
| `w-11` / `h-11` | 44            | 38.5dp       |
| `w-8` / `h-8`   | 32            | 28dp         |
| `py-3`          | 12            | 10.5dp       |

The named tokens in `tailwind.config.js` — `base`, `xs`, `sm`, `md`, `lg`, `xl`, `touch`,
`island-inset`, `tabbar-clearance`, `sign-in` — are declared in literal px and are **not**
affected. `gap-sm` really is 12dp.

**So a touch target never sizes itself from the numeric scale.** Use the `touch` token:
`w-touch`, `h-touch`, `min-w-touch`, `min-h-touch` all resolve to exactly 48dp. DS-119
shipped `w-12` believing it was 48dp; it measured 42dp on a device.

### Small variants reach the floor with slop

`Button` `size="sm"` renders about 33.5dp tall and `IconButton` `size="sm"` 28dp square.
Both mark secondary actions in dense rows where 48dp would crowd the layout, so both
reach the minimum with `hitSlop` instead of growing — 8dp and 10dp per edge. `Button`
`size="md"` cannot reach it on padding alone either, so it carries `min-h-touch`.

`Button` `size="auth"` renders at least 41dp tall (`min-h-sign-in`) and reaches 48dp with 3.5dp of
`hitSlop`. Every button in the sign-in flow uses it (welcome, log in and sign up, password
reset, email verification, onboarding), so those screens share one button height. Apple's native Continue with Apple button
sizes its title from its own height, and 41pt is where that title measures the same as the
`lg` label: 15.75px. Taller makes the Apple title larger than every other button label;
shorter makes it smaller. The native button has no `hitSlop`, so
`LoginForm` wraps it in a `Pressable` that owns the press and turns the native view's touches
off.

The arithmetic lives in `buttonSizeTargets` and `iconButtonSizeStyles` beside each
primitive. Their tests resolve it against the real Tailwind theme via
`utils/tailwind-metrics.ts` rather than recomputing the scale, so a variant that lands
under 48dp fails the suite — and so does one whose declared size stops matching the
class it ships.

Building a raw `Pressable` instead? It answers to the same floor. `hitSlop` is the tool
when the control must stay visually small, and it is counted on both edges.

## Color tokens

Tokens are exposed as Tailwind utilities and backed by CSS variables in
`src/global.css`. Every token has a light and a dark value. Dark grounds are the navy of the
Ganapps logo. Light is a cool off-white with white cards.

Rules that apply to every token:

- **Green as text is `primary-text`.** `primary` is for fills. Green used as text or a thin
  icon is `primary-text`, which clears 4.5:1 on every surface. White on `primary` measured
  2.3:1, so labels on a `primary` fill use `primary-foreground`, a deep green.
- **Secondary text on glass is `on-glass-muted`.** The selected glass segment label is
  `on-glass-primary`.
- **`mint` and `glass-ice` are light, not paint.** Neither is ever a fill or a text color.
- **`brand-lime` is for brand moments only.** Not for buttons or text.
- **`border` is decorative.** Interactive outlines use `input`.
- **Status never relies on color alone.** Pair a color with an icon or a word.
- **`map-*` tokens style the Mapbox map** (hub #277). They are not UI colors.
- **No opacity modifiers** such as `bg-info/10`. The variables hold hex and rgba values, so
  the modifier resolves to no background at all.

### Surfaces and text

Solid ground for content, and the ink that sits on it.

| Token                | Light     | Dark      | Use                                                                                                                                                          |
| -------------------- | --------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `background`         | `#f3f6f4` | `#061a22` | Screen background behind solid content (lists, profile, chat). Dark is the night teal-navy of the Ganapps logo ground. Tailwind `bg-background`.             |
| `foreground`         | `#0a1a14` | `#eef6f2` | Primary text and icons on `background`, `card`, `muted` and every glass fill (16:1 or better in both themes). Tailwind `text-foreground`.                    |
| `card`               | `#ffffff` | `#0d252e` | Solid content surfaces: event rows, stat tiles, info cards, settings groups. Content lives on solid card, never on glass.                                    |
| `card-foreground`    | `#0a1a14` | `#eef6f2` | Text on `card`. Same ink as `foreground`.                                                                                                                    |
| `popover`            | `#ffffff` | `#102c36` | Menus, modals and the opaque body of bottom sheets once expanded past half height.                                                                           |
| `popover-foreground` | `#0a1a14` | `#eef6f2` | Text on `popover`.                                                                                                                                           |
| `muted`              | `#e9efec` | `#12303a` | Quiet fills: the solid segment track, avatar initials ground, skeletons, disabled controls.                                                                  |
| `muted-foreground`   | `#56665f` | `#9fb7b4` | Secondary text: metadata (organizer, date), placeholders, inactive tab labels, helper text. 5.1:1+ on `background`, `card`, `muted` and `glass-fill-strong`. |
| `accent`             | `#e9efec` | `#12303a` | Pressed and hovered row background on solid surfaces.                                                                                                        |
| `accent-foreground`  | `#1f2937` | `#eef6f2` | Text on `accent`.                                                                                                                                            |

### Brand and action

Green means the action or the place. `destructive` is the only red.

| Token                    | Light     | Dark      | Use                                                                                                                                                                                                                                                                |
| ------------------------ | --------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `primary`                | `#22c55e` | `#22c55e` | Ganapps green, unchanged from the current app. Fills the one main action per view (Log In, Enter Event Hub, Send), selected chips, cluster pins and the unread dot. Always paired with `primary-foreground` ink, never white.                                      |
| `primary-foreground`     | `#052e16` | `#052e16` | Label ink on a `primary` fill (6.5:1). Replaces the old white-on-green, which measured 2.3:1.                                                                                                                                                                      |
| `primary-text`           | `#166534` | `#4ade80` | Green used AS text or a thin icon: links (Forgot Password?, Sign Up), the active tab label and glyph, ghost buttons, the selected segment label. 5.1:1+ on `background`, `card`, every glass fill and the `glass-lens` droplet over any map color, in both themes. |
| `brand-lime`             | `#69af01` | `#9bd300` | The lime of the G-pin mark. Reserved for brand moments: the splash halo behind the logo, the Map tab mark ring and your own location puck. Not for buttons or text.                                                           |
| `secondary`              | `#1f2937` | `#1d3a44` | Secondary solid action (My Code, Sign Out). Dark is lifted off the navy ground so it still reads as a button.                                                                                                                                                      |
| `secondary-foreground`   | `#ffffff` | `#eef6f2` | Label ink on `secondary`.                                                                                                                                                                                                                                          |
| `destructive`            | `#b91c1c` | `#f87171` | Destructive actions (Delete account, Leave event confirmation) and field errors. Always with a verb label. Light is red-700 so white labels keep 4.8:1 even under the bezel sheen.                                                                                 |
| `destructive-foreground` | `#ffffff` | `#2a0a0a` | Label ink on a `destructive` fill.                                                                                                                                                                                                                                 |
| `like`                   | `#dc2626` | `#f87171` | Filled heart and like counts. Pair with the heart glyph, never color alone.                                                                                                                                                                                        |
| `save`                   | `#a16207` | `#facc15` | Filled bookmark for saved Ganaps.                                                                                                                                                                                                                                  |

### Status

Soft fills with a same-hue foreground. See [Tonal status badges](#tonal-status-badges).

| Token                | Light     | Dark      | Use                                                                   |
| -------------------- | --------- | --------- | --------------------------------------------------------------------- |
| `info`               | `#dbeafe` | `#172554` | Info banner ground (Public visibility pill, reduced-accuracy notice). |
| `info-foreground`    | `#1e40af` | `#93c5fd` | Text and icon on `info`.                                              |
| `warning`            | `#fef3c7` | `#451a03` | Warning banner ground.                                                |
| `warning-foreground` | `#78350f` | `#fcd34d` | Text and icon on `warning`.                                           |
| `notice`             | `#ede9fe` | `#2e1065` | Organizer announcement highlight ground.                              |
| `notice-foreground`  | `#5b21b6` | `#c4b5fd` | Text on `notice`.                                                     |

### Lines and focus

| Token    | Light     | Dark      | Use                                                                                                             |
| -------- | --------- | --------- | --------------------------------------------------------------------------------------------------------------- |
| `border` | `#d5ded9` | `#1f3d47` | Hairlines between rows and around solid cards. Decorative only; anything interactive uses `input`.              |
| `input`  | `#7a8a83` | `#4f727a` | Outline of text fields, outline buttons and unselected chips on solid ground (3:1+ on `background` and `card`). |
| `ring`   | `#15803d` | `#4ade80` | Focus ring: 2px solid, 2px offset, on every focusable control. 4.6:1+ on every surface in both themes.          |

### Glass colors

The material for controls that float over content. See [Glass](#glass).

| Token                | Light                       | Dark                        | Use                                                                                                                                                                                                                                                                                       |
| -------------------- | --------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `glass-fill`         | `rgba(255, 255, 255, 0.46)` | `rgba(9, 32, 40, 0.42)`     | The default liquid-glass body for controls floating over the map: the tab bar island, map control buttons, top-bar actions. Thin on purpose, so the map glows through. Glyphs and one-word labels only, in `foreground`, `on-glass-muted` or `on-glass-primary`. No sentences.            |
| `glass-fill-strong`  | `rgba(255, 255, 255, 0.76)` | `rgba(9, 32, 40, 0.66)`     | Glass that carries sentences or inputs: the map search bar, toasts, the peek state of the Ganap sheet, the chat composer, chips. Keeps `foreground`, `primary-text` and `on-glass-muted` at 4.5:1 over every map color and map glow.                                                      |
| `glass-fill-solid`   | `#f7faf8`                   | `#0c242d`                   | The Reduce Transparency fallback and the default on Android, where GlassView renders as a plain View. Same shape, rim and shadow; no blur.                                                                                                                                                |
| `glass-ice`          | `#ffffff`                   | `#e6fff5`                   | The brightest light in the material: the top-left stop of the rim and the tint that runs across a glass body. Never a fill or a text color.                                                                                                                                               |
| `mint`               | `#16a34a`                   | `#86efac`                   | The green light inside glass: the bottom-right stop of the rim, the floor light and the inner volume. A lighter step of Ganapps green, so the whole system stays one hue. It is light, not paint: never a control fill or a text color. `primary` stays reserved for the one main action. |
| `glass-rim`          | `rgba(255, 255, 255, 0.72)` | `rgba(255, 255, 255, 0.14)` | The quiet middle of the rim ring, between its lit top-left (`glass-ice`) and bottom-right (`mint`) ends. The rim is what makes glass read as an object rather than a blur.                                                                                                                |
| `glass-highlight`    | `rgba(255, 255, 255, 0.90)` | `rgba(255, 255, 255, 0.24)` | The specular sweep that falls across the top-left corner of a glass shape and fades out before mid-width.                                                                                                                                                                                 |
| `glass-lens`         | `rgba(255, 255, 255, 0.78)` | `rgba(255, 255, 255, 0.14)` | The droplet under the selected glass segment, the chosen reaction in the tray and a pressed menu row: a brighter glass inside the glass.                                                                                                                                                  |
| `glass-tint-primary` | `rgba(34, 197, 94, 0.22)`   | `rgba(34, 197, 94, 0.30)`   | Green-tinted glass for a primary action that floats over imagery (Send in the composer, Directions on the map) and for quiet green grounds (icon discs, the Joined badge). Label in `on-glass-primary`.                                                                                   |
| `on-glass-primary`   | `#14532d`                   | `#bbf7d0`                   | Label and icon ink on `glass-tint-primary` (7.7:1+).                                                                                                                                                                                                                                      |
| `on-glass-muted`     | `#3c4b45`                   | `#cddcd9`                   | Secondary text on any glass fill: metadata in a floating row, placeholders in the search bar and composer, toast messages. Inside glass, `muted-foreground` resolves to this, because flat grey loses contrast over a moving backdrop. 4.5:1 or better on `glass-fill-strong`.            |
| `scrim`              | `rgba(10, 26, 20, 0.32)`    | `rgba(3, 12, 16, 0.60)`     | Dims the screen behind a modal sheet or dialog.                                                                                                                                                                                                                                           |

### Light

Glows and highlights. They are light, not paint.

| Token          | Light                       | Dark                        | Use                                                                                                                                                                                                                        |
| -------------- | --------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `primary-glow` | `rgba(34, 197, 94, 0.35)`   | `rgba(34, 197, 94, 0.45)`   | The soft halo under a selected map pin, the active-tab droplet, and the logo halo on the splash.                                                                        |
| `glow`         | `rgba(34, 197, 94, 0.14)`   | `rgba(74, 222, 128, 0.30)`  | A pool of green light behind glass: the `Lobe` on solid screens and the glow over busy parts of the map. Glass needs light behind it to look like glass. Keep the centre off-canvas or away from `muted-foreground` text.  |
| `glow-lime`    | `rgba(105, 175, 1, 0.10)`   | `rgba(155, 211, 0, 0.14)`   | The outer ring of a `Lobe` and of the logo halo, and the second map glow, in the lime of the G-pin mark.                                                                                                                   |
| `bezel-sheen`  | `rgba(255, 255, 255, 0.55)` | `rgba(255, 255, 255, 0.42)` | The specular highlight on a solid control (primary, secondary and destructive buttons, the selected chip, cluster pins). It falls on the top-left corner only and is gone before the label, so labels keep their contrast. |

### Map

These style the Mapbox map (hub #277). They are not UI colors, so never use them on a control.

| Token            | Light     | Dark      | Use                                                                                           |
| ---------------- | --------- | --------- | --------------------------------------------------------------------------------------------- |
| `map-land`       | `#eef1ec` | `#0b2028` | Mapbox style: land fill. The night style matches `background` so glass sits on a calm ground. |
| `map-block`      | `#e2e6df` | `#10272f` | Mapbox style: building footprints.                                                            |
| `map-road`       | `#ffffff` | `#1b3a44` | Mapbox style: minor roads.                                                                    |
| `map-road-major` | `#f6f1e4` | `#2a4f5a` | Mapbox style: arterials (Diversion Road, Iznart).                                             |
| `map-water`      | `#a9d8ee` | `#072d3d` | Mapbox style: water (Iloilo River, Guimaras Strait).                                          |
| `map-park`       | `#cfe8c9` | `#0f3326` | Mapbox style: parks and plazas.                                                               |
| `map-label`      | `#6b7280` | `#6f8f95` | Mapbox style: street and place labels. Labels stay quiet so pins and glass lead.              |

### Tonal status badges

`info`, `warning`, and `notice` are **soft fills paired with a same-hue
foreground**, unlike `primary` and `destructive`, which are saturated fills with their own
label ink (`primary-foreground` is deep green, `destructive-foreground` is white in light and
near-black in dark). Use them for low-emphasis status metadata — the
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

Semantic roles name a _function_ in the interface. A category color names a
category, and the category list is data that grows as organizers add event
types. Minting `category-social`, `category-sports`, and so on would freeze that
list into the design system and require a token change to add a category. Tags
are also decorative rather than structural: they carry no meaning a color-blind
user loses, because the label is always shown.

The Google icon on the login screen intentionally uses Ganapps' `primary` token
so it follows the app's action color and theme instead of preserving Google's
official blue.

## Glass

Glass is a material, not a color. It has a body, a sweep, a rim, volume and lift.

- **Body.** A fill token (`glass-fill`, `glass-fill-strong` or `glass-fill-solid`) under a
  faint 140° tint of `glass-ice` and `mint`. Behind it, `blur-*` and `glass-saturate` on the
  platforms that can blur.
- **Sweep.** `glass-highlight` falls across the top-left corner and fades out before
  mid-width.
- **Rim.** A ring that runs from `glass-ice` at the top left, through `glass-rim`, to `mint` at
  the bottom right. The rim is what makes glass read as an object rather than a blur.
- **Volume and lift.** The inner light is part of the shadow token. Lift is the one offset
  drop, in `shadow-glass` or `shadow-island`.

Glass is only light enough to see through when something is behind it. On screens with no
map, put a `Lobe` (`glow` and `glow-lime`) behind it.

### The layer rule

Decide by the layer a control sits on, not by the screen it is on. A single screen can hold
glass, solid and capsule layers at once.

1. Does it hold something a person reads or acts on (a date, a price, a code, a form field, a
   message)? It is **solid**.
2. Is it a control floating over content? It is **glass**.
3. Is it pressed, and does it not float? It is a **capsule**.

Never put glass on glass. The lens inside a glass segment is the one exception.

### Glass layers

| Layer   | Recipe                                                                                                                   | Where                                                                                                                                                                                                                |
| ------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Regular | `glass-fill`, `blur-regular`, `rim-md`, `shadow-glass`                                                                   | Map buttons, top-bar actions. Glyphs and one-word labels only                                                                                                                                                        |
| Strong  | `glass-fill-strong`, quieter sweep                                                                                       | Search bar, chips, one-sentence toasts, composer, the action bar                                                                                                                                                     |
| Island  | `glass-fill` for the tab bar, `glass-fill-strong` for the action bar and sheets, `blur-thick`, `rim-lg`, `shadow-island` | The highest layer                                                                                                                                                                                                    |
| Menu    | `glass-fill-solid` at 90%, `rim-lg`                                                                                      | Context menus, which are all text                                                                                                                                                                                    |
| Tint    | `glass-tint-primary`, `on-glass-primary`                                                                                 | A primary action floating over imagery (Send)                                                                                                                                                                        |
| Lens    | `glass-lens`, `rim-sm`, `shadow-lens`                                                                                    | The selected glass segment and the chosen reaction                                                                                                                                                                   |
| Bar     | Strong body, no rim, no radius                                                                                           | A header that spans the screen; content fades under it                                                                                                                                                               |
| Solid   | `glass-fill-solid`, same rim and shadow, no blur                                                                         | Notices, the offline banner, error toasts, help popovers, the map preview row, form and detail sheets; also every glass surface under Reduce Transparency, Increase Contrast, and wherever the platform has no glass |

### Text limits for glass

Glass is not a surface for reading.

- **Regular glass** takes a glyph or one word.
- **Strong glass** takes one short line: a label, a placeholder, or one sentence in a toast.
- **Solid with the glass edge** carries anything longer, and all data people act on: date and
  time, venue and address, price, QR and check-in codes, and errors.

Text on glass is `foreground`, `primary-text`, `on-glass-primary` or `on-glass-muted`. Never
`muted-foreground`, because flat grey loses contrast over a moving backdrop.

### Rim width by size

A thick rim swallows a small control, so the rim grows with the surface. In `theme.ts` these
are the `Rim` constants. Tailwind has matching `borderWidth` entries (for example
`border-rim-md`).

| Token      | Width | Use                                                                    |
| ---------- | ----- | ---------------------------------------------------------------------- |
| `rim-hair` | 1px   | Glass under 32px tall: the reaction pill, pin labels, progress tracks  |
| `rim-sm`   | 1.5px | Chips, 36px icon buttons, the tab lens, the selected segment, map pins |
| `rim-md`   | 2px   | 48px controls, the search bar, toasts, the composer                    |
| `rim-lg`   | 2.5px | The tab island, the action bar, sheets, menus                          |

### Blur

| Token            | Value | Use                                                |
| ---------------- | ----- | -------------------------------------------------- |
| `blur-thin`      | 12px  | Chips and pins over the map                        |
| `blur-regular`   | 22px  | Map controls, the search bar, toasts, the composer |
| `blur-thick`     | 40px  | The tab island and sheets                          |
| `glass-saturate` | 180%  | Saturation boost behind every blur                 |

These are CSS values for web and Storybook only. The app's live glass does not frost: it bends the
map instead, so it uses `GLASS_BACKDROP_BLUR` (0.3dp) in `src/components/common/GlassMaterial.tsx`.
`Blur` and `GLASS_SATURATE` in `src/constants/theme.ts` are kept for the web reference.

### Capsules

A capsule is a lit solid control. It is raised, so it reads as pressable.

- A light-to-dark fill in the control's own color.
- `bezel-sheen` falling on the top-left corner only.
- `shadow-bezel` for the lit volume, plus a drop glow in the control's fill color. Chips have
  no glow: they sit in horizontal scroll rows, which clip it to a hard rectangle.
- `shadow-bezel-pressed` when pressed.

Primary, secondary and destructive buttons, the selected chip and cluster pins are capsules.
Fields are the opposite: they are carved in with `shadow-well`. Raised means pressable;
recessed means typeable.

### Platform tiers

Glass is drawn two ways today, with a third planned. Which one a pane gets is decided in the `Glass`
primitive, never per screen.

| Tier         | Where                                                                                     | How                                                                                                                  |
| ------------ | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Live glass   | Android and iOS, a `regular` or `strong` pane inside a `GlassBackdrop` that has a capture | `GlassMaterial` (React Native Skia) refracts a GPU capture of the backdrop under the Solid rim, tint, sweep and bevel |
| Liquid Glass | iOS 26 and newer (planned, hub #280)                                                      | `GlassView` from `expo-glass-effect`                                                                                 |
| Solid        | Everything else                                                                           | `glass-fill-solid`, same shape, rim and shadow                                                                       |

Solid is the baseline, and the live tier falls back to it. `Glass` picks in this order:

1. Performance mode (Settings) or Reduce Transparency is on: Solid.
2. The pane is `tint`, `solid` or the flat bar (`lift="none"`): Solid.
3. The pane sits inside a `GlassBackdrop` that has captured its backdrop: live glass.
4. Otherwise: Solid.

How live glass works (ADR 0010):

- A screen wraps itself in one `GlassBackdrop` and wraps only the backdrop, today the Mapbox map, in
  `GlassBackdropTarget`. Never wrap a view that holds glass: the capture would include the glass.
- The screen asks for a capture through the backdrop's ref: on every camera change and when the map
  settles. One capture feeds every pane on the screen.
- A capture renders the target into a GPU texture with `react-native-webgpu`
  (`drawElementImageToTexture`) and wraps it as a Skia image without a copy. It costs about 45 ms on a
  2021 Android phone (Infinix X6711), so the glass trails the map by about one capture.
- Mapbox must draw into a TextureView while live glass is on: `surfaceView={!useLiveGlassEnabled()}`,
  with a `key` on the same value so the map is recreated when it changes. A SurfaceView map captures
  blank.
- Each pane measures its place against the capture whenever a new one lands. A pane that moves
  without a new layout, like a chip in a scrolling row, calls `remeasure()` from the scroll handler. A
  pane that moves under the finger, like a sheet, uses `solid`.
- The fill over the backdrop is the token for the pane: `glass-fill` for `regular` (glyphs, one word) and
  `glass-fill-strong` for `strong` (a line of text, inputs). Text limits are unchanged; longer text and data
  sit on a solid surface.
- The material is `GlassMaterial`. Never rebuild the rim, tint or bevel in a screen.

**In the app today:** the home map's search bar, filter chips, Map view control, locate button and
notices draw live glass. The tab island sits outside the home `GlassBackdrop`, so it and every other
screen draw Solid. Compose every control from `Glass`, `Capsule` and `PressableScale`.

How the Solid recipe is drawn in React Native:

- The rim, the body tint, the sweep and the capsule run are `experimental_backgroundImage`
  gradients with `experimental_backgroundRepeat: 'no-repeat'`. Without no-repeat the tile
  repeats into a transparent border and draws a stray arc at the edge.
- `color-mix()` has no React Native equivalent; `mix()` in `src/utils/color-mix.ts` computes it
  from the tokens.
- No gradient position may be negative: Android drops it.
- Rims and rings never add size. The primitive keeps the control's own layout classes,
  including a transparent 1dp border where the control had one, so touch targets stay exact.
- Inset shadows draw only on Android 10 and newer, so Input and Card keep real borders.

## Typography

Font family: **Allo Ganapps**, a cut of Allo 1.0.1 fitted to SF. It ships as four static
files, never the variable font (`AlloVariable.woff2` is a web lab font only):

| Utility              | File                       | Weight          |
| -------------------- | -------------------------- | --------------- |
| `font-sans`          | `AlloGanapps-Regular.ttf`  | 400             |
| `font-allo-medium`   | `AlloGanapps-Medium.ttf`   | 500             |
| `font-allo-semibold` | `AlloGanapps-SemiBold.ttf` | 590 (class 600) |
| `font-allo-bold`     | `AlloGanapps-Bold.ttf`     | 700             |

The files are Allo cut at roundness 0 and its Text optical size, with units per em set to
2115 so a capital is as tall as SF's at the same point size. Sizes in the scale need no
adjustment. Each file's PostScript name equals its file name, so the same family name works
on Android (file name) and iOS (PostScript name). The licence is `assets/fonts/Allo-OFL.txt`
(SIL OFL 1.1); keep it with the files.

Outside `className` (for example a Markdown style map), use `Fonts` from
`src/constants/theme.ts` and set the family for the weight instead of `fontWeight`.

### Scale

| Style         | Size / leading | Weight | Tracking (px) |
| ------------- | -------------- | ------ | ------------- |
| `display`     | 40 / 44        | 700    | -1.51         |
| `headline-lg` | 32 / 40        | 700    | -0.78         |
| `headline-md` | 20 / 28        | 600    | -0.06         |
| `headline-sm` | 16 / 24        | 600    | +0.22         |
| `body-xl`     | 18 / 28        | 400    | -0.09         |
| `body-lg`     | 16 / 24        | 400    | +0.04         |
| `body-md`     | 14 / 20        | 400    | +0.16         |
| `label-md`    | 12 / 16        | 600    | +1.03         |
| `label-sm`    | 11 / 14        | 500    | +0.38         |
| `input-lg`    | 16 / —         | 400    | —             |
| `input-md`    | 14 / —         | 400    | —             |

`display`, `headline-lg` and `label-md` include the scale's own tracking (-0.03em, -0.02em and
+0.05em). Every other style takes the tracking Allo calls for at its size and weight.

Use:

- `display` is the splash wordmark title. Once per screen.
- Screen titles are `headline-lg`.
- Section and sheet titles are `headline-md`.
- Card and row titles are `headline-sm`.
- Metadata is `body-md` in `muted-foreground`.
- Tab labels are `label-sm`.
- Uppercase eyebrows are `label-md`.
- Large numbers (profile stats) are 28/34 Allo 700 with -0.02em tracking, and `tnum` where the
  number updates in place.

For a size the scale does not name, take the tracking from this table (px):

| Size     | 11    | 12    | 13    | 14    | 15    | 16    | 17    | 18    | 20    | 22    | 24    | 28    | 32    | 40    |
| -------- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| Regular  | +0.31 | +0.27 | +0.21 | +0.16 | +0.10 | +0.04 | -0.05 | -0.09 | -0.30 | -0.49 | -0.61 | -0.72 | -0.86 | -1.21 |
| Medium   | +0.38 | +0.35 | +0.30 | +0.26 | +0.20 | +0.15 | +0.06 | +0.03 | -0.15 | -0.32 | -0.41 | -0.49 | -0.59 | -0.87 |
| SemiBold | +0.43 | +0.40 | +0.36 | +0.32 | +0.27 | +0.22 | +0.14 | +0.12 | -0.06 | -0.20 | -0.28 | -0.33 | -0.40 | -0.64 |
| Bold     | +0.51 | +0.48 | +0.45 | +0.41 | +0.37 | +0.33 | +0.25 | +0.23 | +0.08 | -0.04 | -0.09 | -0.09 | -0.14 | -0.31 |

Allo differs from SF by about a tenth of its ink. Its bold at body size and its regular at 28px
and above fit SF less well, and the app uses neither.

Single-line `TextInput`s use the `input-*` sizes, never `body-*`. iOS clips the descenders of
g, j, p, q and y when a single-line text field has a line height, so these tokens set only
size and weight and let the field take the font's natural height. They carry no tracking for
the same reason. Multiline inputs keep their `body-*` size.

A single-line form field is at least 48dp tall (`min-h-touch`), with or without a trailing icon,
and its text input fills that height; it grows with the system text size. `Input` applies this, so the password field with its show
toggle is the same height as the email field above it.

Default body color is `text-foreground`. Each size token carries its own
`fontWeight`, which is what gives headings their weight by default — Android
synthesizes it over the regular file. Override it only when you need a weight
the size token does not provide.

React Native does not synthesize _named_ families — the font family _is_ the
weight, and each one is a separate file registered by the `expo-font` config
plugin in `app.config.js`. Adding a weight means adding the file, listing it in
`app.config.js`, adding the token, **and** running `npx expo prebuild --clean`
plus a native rebuild — a config plugin does not take effect on a Metro reload.

`npm run check:tokens` checks the scale (size, line height, weight and tracking) and the
four families in `tailwind.config.js` against `docs/design/tokens.json`.

### Why `Text` drops its default family

`components/common/Text.tsx` applies `font-sans` only when the caller has not
named a family of its own. Tailwind emits `.font-sans` after every
named-family utility (`.font-allo-*`), so a default kept alongside the caller's class wins
on source order — which once silently rendered every bold and semibold label in the app as
regular, including inside `Button` and `Avatar`. `text-foreground` follows the same rule. Any new text primitive that hardcodes a family owes callers the same
escape hatch.

## Spacing

| Token              | Value | Use                                                                                                        |
| ------------------ | ----- | ---------------------------------------------------------------------------------------------------------- |
| `base`             | 4px   | Hairline gaps (`p-base`)                                                                                   |
| `xs`               | 8px   | Icon to label (`gap-xs`)                                                                                   |
| `sm`               | 12px  | Chip and segment padding (`p-sm`)                                                                          |
| `md`               | 16px  | Card padding (`p-md`)                                                                                      |
| `lg`               | 24px  | Between sections (`gap-lg`)                                                                                |
| `xl`               | 32px  | Above a screen's primary action group (`gap-xl`)                                                           |
| `touch`            | 48px  | Minimum touch target, ADR 0005 (`min-h-touch`, `MIN_TOUCH_TARGET`)                                         |
| `margin-mobile`    | 16px  | Screen side margin (`px-margin-mobile`)                                                                    |
| `gutter-mobile`    | 12px  | Gap between grid items (`gap-gutter-mobile`)                                                               |
| `island-inset`     | 12px  | Gap between the floating tab bar and the bottom safe-area edge, and its side inset                         |
| `tabbar-clearance` | 96px  | 64 bar, 12 inset and 20 breathing room. Tab screens add this plus the bottom inset to their scroll padding |

In code these are `Spacing` in `src/constants/theme.ts` (`'margin-mobile'`, `'gutter-mobile'`,
`'island-inset'`, `'tabbar-clearance'` are quoted keys). `tailwind.config.js` also has
`sign-in` (41px), which is a button height and not part of the scale.

## Radii

| Token  | Value  | Use                                                                                                                                              |
| ------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `sm`   | 4px    | Unread badges with a count, progress tracks                                                                                                      |
| `md`   | 12px   | Segment lenses, thumbnails, image corners inside cards                                                                                           |
| `lg`   | 16px   | Inputs and rectangular buttons                                                                                                                   |
| `xl`   | 24px   | Cards, event rows, the segment track, toasts                                                                                                     |
| `2xl`  | 32px   | Bottom sheets (top corners), the action bar and the hero image on Ganap detail. Matches the iPhone display corner, so sheets nest concentrically |
| `full` | 9999px | Pills and circles: the tab bar island, chips, map controls, avatars, the primary button on glass                                                 |

Buttons are pills (`full`) in Ganapps Glass. `Button` still uses `rounded-lg` today, and moves to
`rounded-full` with the primitives work.

## Shadows

Ganapps Glass has eight shadow tokens. Two are the plain elevation of solid surfaces. Six
belong to glass and capsules, and are made of several layers, some of them `inset`.

| Token                  | Where it is used                                                                              |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| `shadow-sm`            | Solid cards on `background`                                                                   |
| `shadow-md`            | The primary button and selected pins                                                          |
| `shadow-glass`         | The glass material on every glass control except the island and sheets                        |
| `shadow-island`        | The tab island, the action bar and sheets                                                     |
| `shadow-lens`          | The selected glass segment and the chosen reaction                                            |
| `shadow-bezel`         | The lit volume on solid capsules. The stylesheet adds a drop glow in the control's fill color |
| `shadow-bezel-pressed` | The pressed state of any control, solid or glass                                              |
| `shadow-well`          | Carved-in surfaces: text fields, the segment track, the composer field                        |

Each token has a light and a dark value, and the dark values are deeper. The full strings are
in `docs/design/tokens.json`.

### Applying a themed shadow

Themed shadows come only from `Shadows[theme]` in `src/constants/theme.ts`, with the keys
`sm`, `md`, `glass`, `island`, `lens`, `bezel`, `'bezel-pressed'` and `well`. Apply one with
`style.boxShadow`:

```tsx
const theme = useResolvedTheme();

<View style={{ boxShadow: Shadows[theme].glass }} />;
```

NativeWind cannot theme `shadow-*` classes. Its native shadow plugin cannot read `var()`, keeps
only the first layer of a shadow and ignores `inset`. So there are no themed `shadow-*`
classes. The `shadow-sm` and `shadow-md` classes in `tailwind.config.js` stay as light-only
literals, which suits a card on a light ground and nothing else: use `Shadows[theme].sm` or
`Shadows[theme].md` wherever the dark theme matters. The other `boxShadow` entries in
`tailwind.config.js` (`DEFAULT`, `lg`, `xl`, `2xl`) are Tailwind defaults and are not part of
the system.

## Component patterns

### Button

Variants: `default`, `secondary`, `outline`, `ghost`, `destructive`, `link`.
Sizes: `sm`, `md`, `lg`, and `auth` for every button in the sign-in flow: welcome, log in and sign up, password reset, email verification, and onboarding. `auth` is held at Apple's native button height (`min-h-sign-in`, 41dp) by a floor, not a fixed height, so its label grows with the system text size instead of clipping. A `variant="link"` button always renders at the `link` size, a `body-md` label with no horizontal padding, so links match the copy around them.

- `default`: a `primary` capsule with `primary-foreground` text.
- `secondary`: a `secondary` capsule with `secondary-foreground` text.
- `outline`: transparent with an `input` outline and `foreground` text.
- `ghost`: transparent, hover uses `accent`.
- `destructive`: a `destructive` capsule with `destructive-foreground` text.
- `link`: text only, with no underline. The label is semibold `primary-text`.

On a glass layer, the one main action is `glass-tint-primary` with `on-glass-primary` text
(Send in the composer), not a `primary` capsule.

### Input

An input is a well: carved in with `shadow-well`, never raised.

- Background: `background`
- Border: `input` (`ring` when focused, `destructive` on error)
- Error border: `destructive`
- Placeholder: `muted-foreground` (`on-glass-muted` inside glass)
- Label: `foreground`, `label-md` size
- Height: at least 48dp (`min-h-touch`) for a single-line field, with or without a trailing icon. It
  grows with the system text size instead of clipping.
- One-time codes (`variant="code"`): at least 64dp, the digits centred in semibold `headline-md`
  with wide tracking, and `autoComplete="one-time-code"` so the keyboard can offer the code.
- Autofill and order: pass `autoComplete` (and `textContentType` for iOS) so password managers can
  fill the field, and chain fields with `returnKeyType="next"` and `onSubmitEditing` calling
  react-hook-form's `setFocus`. The last field's return key submits.
- Horizontal padding: `px-md`

### Card

Cards are solid, never glass.

- Background: `card`
- Text: `card-foreground`
- Border: `border` (optional)
- Shadow: `shadow-sm`
- Radius: `lg` or `xl`

### Chips

Used for selectable items such as interests.

- Unselected: glass (Strong layer) with `foreground` text
- Selected: a `primary` capsule with `primary-foreground` text
- Radius: `full`
- Rim: `rim-sm`

On a solid ground an unselected chip is `background` with an `input` outline.

### Segmented control

The track is a well (`muted`, `shadow-well`, radius `xl`). The selected segment is a `glass-lens`
droplet (radius `md`, `rim-sm`, `shadow-lens`) with its label in `on-glass-primary`.

### Avatar

- Default: branded placeholder with initials or `default-avatar.jpg`
- Edit overlay: `primary` circular badge with camera icon
- Size variants: `sm`, `md`, `lg`

### Focus ring

Every focusable control shows a 2px solid `ring` outline with a 2px offset. `ring` is 4.6:1 or
better on every surface in both themes.

### Screen headers

Every screen that draws its own header uses `ScreenHeader`
(`components/navigation/ScreenHeader.tsx`), except the sign-in screens, which use `AuthScreen` (see
[Sign-in screens](#sign-in-screens)). It owns the top inset plus 16dp, a 48dp row,
the filled back button (`IconButton` `variant="default"` with `ArrowLeft` at 20), and a
bold `text-headline-md` title (`font-allo-bold`). Stacks hide their native headers. Loading and error
states render the header too, so a screen is never left without a way back; registration and
feedback turn off swipe-back, which makes this the only exit there. Event details and the Event
Hub keep their own header because it floats over a photo, with the same back button.

A header that spans the screen over scrolling content is a Bar: a Strong body with no rim and no
radius, and the content fades under it.

### Type roles

| Role                                | Style                                                           | Weight   |
| ----------------------------------- | --------------------------------------------------------------- | -------- |
| Splash title                        | `display`                                                       | Bold     |
| Screen title                        | `headline-lg`                                                   | Bold     |
| Full-screen modal title             | `headline-md`                                                   | Bold     |
| Bottom sheet title                  | `headline-sm`                                                   | Bold     |
| Section heading                     | `headline-sm`                                                   | SemiBold |
| Overline                            | `text-label-md uppercase tracking-widest text-muted-foreground` | SemiBold |
| Field label                         | `text-label-md text-foreground`                                 | SemiBold |
| Body, empty, loading and error copy | `text-body-md`                                                  | Regular  |

The weight is the family utility: `font-allo-bold` and `font-allo-semibold`. `ScreenHeader` still sets its title in
`headline-md`; moving screen titles to `headline-lg` happens with the screen work, not here.

### Button sizes by role

Full-width actions use `lg`, primary and secondary alike. `sm` is for compact actions in a row,
such as Add friend and My code. A Button sizes its own icons, 16dp on `sm` and 18dp otherwise, so
pass `leftIcon` and `rightIcon` without a `size`. Text that acts as a link is a
`Button variant="link"`, never a styled `Text` in a `Pressable`.

### Lobe

A `Lobe` (`components/common/Lobe.tsx`) is one static pool of light behind glass on a screen
without a map. It is a radial gradient: `glow` at the centre, `glow-lime` at 38%, transparent
from 70%.

- Placement: `size` is the diameter, and `top`, `right`, `bottom` and `left` place it, all in dp.
  Offsets may be negative, so the centre can sit off-canvas.
- Opacity: `opacity`, 1 by default.
- The parent clips it with `overflow-hidden`.
- It ignores touch and is hidden from screen readers.

The splash and Welcome share one placement, `ONBOARDING_LOBES` (`constants/onboarding.ts`): a
460dp lobe off the top-right corner and a 440dp lobe off the bottom-left at 0.85 opacity.

### Sign-in screens

Log in and sign up (`app/(auth)/login.tsx`), password reset (`app/(auth)/forgot-password.tsx`),
email verification (`app/verify-email.tsx`) and both profile setup steps (`app/onboarding.tsx`)
share one frame, `AuthScreen` (`components/auth/AuthScreen.tsx`), so the flow reads as Welcome
continued. They do not use `ScreenHeader`.

**The frame.** The `background` ground with one `Lobe` off the top-right corner (460dp, 0.9
opacity), the same corner Welcome lights. A 48dp header row 16dp below the safe area holds the
filled back button (`IconButton` `variant="default"`, `ArrowLeft` at 20) on the left and an
optional accessory on the right. Under it, top-aligned, the title in `headline-lg` bold and one
`body-md` `muted-foreground` line, then the form. Nothing is centred vertically, so the keyboard
never lands on the content.

**Layers.** Everything is solid: fields are wells, the main action is the `primary` capsule, the
Google button stays the glass `outline` Button. There is no glass panel behind the form.

**Keyboard.** The scroll area and the optional pinned `footer` sit in a `KeyboardAvoidingView`
with `behavior="padding"` on both platforms. The app is edge-to-edge on Android, so the window
does not resize for the keyboard; the padding is what keeps the last field and the button
reachable. In the bounded `footer`, put a link `Button` in a `flex-row` (as Skip for now does): set
straight in a column `View` there, it stretched to fill the footer and collapsed the scroll area to
nothing on Android.

| Screen         | Title                                   | Header right   | Footer                     |
| -------------- | --------------------------------------- | -------------- | -------------------------- |
| Log in         | Welcome back                            | none           | none                       |
| Sign up        | Create your account                     | none           | none                       |
| Password reset | Reset your password (line follows step) | none           | none                       |
| Verify email   | Verify your email (names the address)   | Sign out       | Delete account, as a link  |
| Profile, 1     | What should we call you?                | 1 of 2         | Continue                   |
| Profile, 2     | Add a photo and interests               | 2 of 2         | Finish, Skip for now       |

**Errors.** A field error shows under its field. A rejected verification code is set on the code
field, not raised as a toast. A failed log in or sign up shows one `destructive` line above the
main action. The Terms and Privacy links sit on one line under "By continuing you agree to our",
as on Welcome.

### Splash and Welcome

The splash and Welcome are one composition. `SplashView` (`components/onboarding/SplashView.tsx`)
is the first JS frame under the native splash. Welcome (`app/(public)/index.tsx`) starts from that
same frame and settles into its own layout, so launch has no visible jump.

**The lockup.** `BrandLockup` (`components/onboarding/BrandLockup.tsx`) draws the logo, the
`display` bold title and the tagline for both screens from one `progress` value. At 0 it is the
splash: the logo centred in the window at `SPLASH_LOGO_SIZE` (about 134dp) with a `brand-lime`
halo, the title under it and the tagline in `body-md` `muted-foreground` under that. At 1 it is the
header position: the logo at `HEADER_LOGO_SIZE` (72dp), its top 20dp below the safe area. The lime
halo is gone by 0.6 and the tagline by 0.25. Welcome fades the whole lockup out as it lifts and
fades the wordmark logo in where it lands, so the round mark is the splash and the wordmark is the
header.

**Why it lines up.** The native splash (`app.config.js`) draws
`assets/brand/ganap-logo-round.png` 200dp wide (`imageWidth`), and the disc is 726 of the PNG's
1080px. So `SPLASH_LOGO_SIZE` must stay `200 * 726 / 1080`, and `BrandLogo` draws the PNG larger
than its box so the disc fills it. Change the PNG, its disc or `imageWidth` and update
`SPLASH_LOGO_SIZE` with them. The native splash ground is `background` in both themes, the same
ground `SplashView` paints.

**The stage.** A full-screen photo sits behind everything, buttons included. Each photo is a
1080 by 2400 WebP (a 9:20 screen) with the phone the people hold on the canvas centre, drawn with
`cover`, so the phone stays on the centre of any screen: a wider screen crops the top and bottom
evenly, a taller one the sides. `OnboardingStage` (`components/onboarding/OnboardingStage.tsx`) is
a horizontal pager with one photo per slide.

**One slide ships.** `ONBOARDING_SLIDES` (`constants/onboarding.ts`) holds one slide today: its
`image`, a `caption` (the headline), a `body` line and an `imageLabel` for screen readers. The
pager, the headline cross-fade and the page dots already handle more. To add a slide, add its
photo to `Assets.onboarding` (`constants/assets.ts`) and an entry to `ONBOARDING_SLIDES`; the dots
appear once there are two.

**Swapping a photo.** Export the new photo on the same 1080 by 2400 canvas with the phone on the
centre and save it over `assets/images/onboarding/onboarding-N.webp`. Use a portrait source: a
landscape one cannot reach the top and bottom of a tall canvas with the phone centred. Then update
the slide's `imageLabel`.

**The scrims.** Two gradients of `background` keep text readable over any photo, so the screen
follows the theme: a light wash in light, a navy one in dark. The top scrim sits behind the
wordmark. The bottom scrim starts 140dp above the copy and deepens in steps. Its strength at each
step is the least that holds 4.5:1 (3:1 for the headline) over the worst photo for that theme,
plus a margin: thin behind the headline, thinner still behind the buttons (which are opaque), and
deepest behind the small print. The values are the `SCRIM` table in `app/(public)/index.tsx`. Gradients
end in `background` at 0% alpha, never `transparent`, which greys the fade.

| Stop        | Light | Dark |
| ----------- | ----- | ---- |
| Top edge    | 68%   | 80%  |
| Under logo  | 60%   | 72%  |
| Headline    | 50%   | 60%  |
| Body line   | 60%   | 70%  |
| Buttons     | 66%   | 74%  |
| Small print | 86%   | 84%  |
| Bottom edge | 90%   | 90%  |

**The copy.** The slide headline is `headline-lg` bold in `foreground`, with one `body-md` line
under it. Secondary text over the photo is `on-glass-muted`, not `muted-foreground`: flat grey
loses contrast over a backdrop.

**The ways in.** `OnboardingSignIn` (`components/onboarding/OnboardingSignIn.tsx`) holds, top to
bottom: the page dots, Continue with Apple and Continue with Google where they are available, Sign
up with Email, the Terms and Privacy links, and "Already have an account? Log in".

- Sign up with Email is the one green action, with a mail icon. Apple and Google stay neutral. Its
  capital E is a product decision and the one exception to sentence case.
- Every button is the `auth` size, which matches Apple's native button.
- The buttons sit straight on the scrim. There is no glass panel behind them: the Google button is
  glass, and glass never sits on glass.
- Apple and Google sign in from here with the same code as the login form: `useSocialSignIn`
  (`hooks/useSocialSignIn.ts`) and `SocialSignInButtons` (`components/forms/SocialSignInButtons.tsx`).
  A failure raises the error toast; an error never sits over the photo.
- Sign up with Email opens the login screen in sign-up mode (`Routes.auth.signup`); Log in opens it
  in log-in mode. The form slides up from the bottom and covers the photo.

**Text size.** The copy block measures its text and makes room for it, so large text pushes the
buttons down rather than sliding under them, and the link rows wrap. If the copy and the ways in
ever outgrow the room under the logo, they scroll.

**The page dots.** `OnboardingDots` shows one dot per slide, and none when there is one slide. The
current slide's dot is long (22dp); the others are round (6dp), 10dp apart. As the pager moves, the
dot being left shrinks and the next one stretches, 1:1 with the finger.

**The entrance.** Welcome opens in the splash composition and settles in 1.4 seconds:

| Window (ms)  | Element       | Change                                |
| ------------ | ------------- | ------------------------------------- |
| 0 to 450     | Lockup        | Held as the splash                    |
| 450 to 950   | Lockup        | Lifts to the header position          |
| 600 to 1150  | Photo         | Fades in, settling from 106% to 100%  |
| 700 to 950   | Lockup        | Fades out                             |
| 800 to 1300  | Copy, buttons | Rise 24dp and fade in                 |
| 850 to 1150  | Wordmark      | Fades in                              |

Nothing blocks a touch while it plays. With Reduce Motion on, the lockup fades out and everything
else fades in over 150ms, with no movement.

## Interaction patterns

This is the short version. Screens follow it, and every gesture has a visible alternative: a
gesture is always a shortcut, never the only way.

### Four feel rules

1. **Answer on touch-down.** A pressed control scales to 0.97 (0.94 for icons and tabs) the
   moment the finger lands, not on release.
2. **Content stays under the finger.** Drags track 1:1 once past a 10px threshold.
3. **Everything can be caught mid-flight.** A moving sheet or row can be grabbed again.
4. **Springs, not timers.**

### Gestures

| Gesture                                       | Used for                        |
| --------------------------------------------- | ------------------------------- |
| Tap                                           | The primary action              |
| Swipe a row (`SwipeRow`)                      | Trailing actions on a list row  |
| Touch and hold (`ContextMenu`, `ReactionBar`) | Secondary actions and reactions |
| Left-edge swipe                               | Back                            |
| Pull to refresh                               | Reloading a list                |
| Sheet drag                                    | Resizing and dismissing a sheet |
| Map gestures                                  | Pan, pinch, rotate, tilt        |

Swipe rows have at most three actions per side. A full swipe commits only what is trivial to
undo. One row is open at a time.

### Menus, sheets and alerts

- **Context menus** show only the actions that apply, in at most three groups, with destructive
  actions last. Hide an action rather than dimming it.
- **Sheets** hold one scoped task. Detents are medium and large; the map feed also has a 180px
  peek. Swiping down dismisses, with a confirmation if the person has typed something. One
  sheet at a time. Cancel sits top-leading and Done top-trailing. The ground behind is `scrim`.
  A short sheet is glass; a form or detail sheet is solid.
- **Confirming a choice** after an action: a confirmation sheet.
- **Rare, serious, irreversible actions:** an alert, with at most three buttons. Never show an
  alert at launch.
- **Completion:** a `Toast`.
- **Everyday reversible actions** ask no question. They happen, and an Undo toast follows.

### Tabs and search

The tab bar holds the four top-level sections. Actions never go in it, and the unread dot on
Friends is the only badge. A search field's placeholder says what can be searched.

The tab bar is the Ganapps Glass island (`AppTabBar`): 64dp tall, at most 358dp wide, on
`Glass` with `lift="island"` and `rim="lg"`. The active tab sits on a `primary` `Capsule` lens
that slides between tabs on a no-bounce spring (380ms, damping ratio 1); with Reduce Motion it
fades out, moves and fades back in. Tab content itself never slides. On the map, the feed
sheet passes under the island and raises its peek by the island's strip, and the bottom
controls rest above the Mapbox logo row.

### Haptics

Selection, impact (light or medium), and notification (success, warning or error). Haptics are
never the only signal. `expo-haptics` is not installed yet.

### Motion

| Kind     | Duration                  |
| -------- | ------------------------- |
| Press    | 100 to 160ms              |
| Popovers | 150 to 200ms              |
| Sheets   | Up to 500ms               |
| Exits    | Quicker than the entrance |

With Reduce Motion on, use a 150ms cross-fade: no overshoot and no animated blur.

### Accessibility

- Targets are 48dp.
- Text scales to 200%.
- Contrast is 4.5:1 for text and 3:1 for icons and outlines.
- Reduce Transparency and Increase Contrast switch glass to `glass-fill-solid` and add an
  outline.
- Swipe and hold gestures have VoiceOver custom actions.

**Not built yet.** `SwipeRow` and `ContextMenu` are not in the repo. The chat's
`MessageReactionBar` and `MessageReactionOverlay` and the `Toast` and `ToastHost` exist.

## Dark mode

The user picks Light, Dark or System in Settings; `useResolvedTheme` resolves that
against the device. `ThemeProvider` passes the choice to NativeWind's
`colorScheme.set`, and Tailwind is configured with `darkMode: 'class'`. Read the
theme with `useResolvedTheme`, never `useColorScheme`: `useColorScheme` reports the device and
ignores the user's choice.

Dark grounds are the logo navy: `background` is the night teal-navy, and cards and popovers
step up from it. Glass over navy gets a lighter rim and a deeper shadow, which is why the
glass and shadow tokens carry their own dark values.

`ThemeProvider`'s root view always carries exactly one theme class, `light` or
`dark`. In `src/global.css` the light palette is declared under `:root, .light` and
the dark palette under `.dark`, so the root view sets CSS variables from its first
render. Keep it that way:

- Don't drop the `light` class or apply a theme class only in dark mode.
  react-native-css-interop re-wraps a view that gains CSS variables after its first
  render, which remounts everything under it. On the root view that meant the first
  theme switch in a session reset navigation to the home screen (DS-215).
- Don't move the dark palette to `.dark:root`. Those root variables follow the
  native appearance, which a newly opened window (the dev LogBox, for one) can reset
  to the system theme while the user has chosen Light or Dark.

Always test both themes when adding new UI, and test glass with Reduce Transparency on.

## Brand assets

- Logo mark (square): `assets/brand/ganap-logo-1.png`
- Logo mark (round): `assets/brand/ganap-logo-round.png` (`Assets.logoRound`) — the square mark
  cut to the centered circle Android's splash mask shows. The native splash draws it 200dp wide on
  `background` in both themes, on iOS and Android alike, and `BrandLogo` draws it in the app. Its
  disc is 726 of its 1080px; see [Splash and Welcome](#splash-and-welcome).
- Welcome photos: `assets/images/onboarding/onboarding-N.webp` (`Assets.onboarding`), one per
  slide in slide order; see [Splash and Welcome](#splash-and-welcome)
- Logo with wordmark, green text for light grounds: `assets/brand/ganap-logo-green-text.png`
- Logo with wordmark: `assets/brand/ganap-logo-white-text.png`
- Default avatar: `assets/images/default-avatar.jpg`

## Voice and copy

The app speaks directly to attendees:

- “All the ganaps, in one app.”
- “Find what’s happening across Iloilo.”
- “Discover nearby events, join the map, and never miss a ganap.”

Keep labels action-oriented and concise. Avoid organizer/business terminology
in user-facing surfaces.

Use sentence case for buttons, titles, labels and links: "Add friend", "Edit profile",
"Try again". Glossary names keep their capitals (Event Hub, Event Chat, Direct Chat, Friend
Code), and so do document names (Terms of Service, Privacy Policy). User-facing copy says
"event" and "people", never "Ganap" or "students".
