# Design

How Nutrijurnal looks, feels and moves — the decisions first, then the tokens that carry
them, then the shell and the building blocks every screen is made of. The tokens live in
`app/assets/css/main.css`, the Nuxt UI theme in `app/app.config.ts`, the building blocks
in `app/components/shell/`.

## Direction

**A quiet iOS app.** Nutrijurnal is opened three to six times a day, usually with one
hand, often with food nearby. It should feel like something Apple could have shipped next
to Health and Fitness: system type, grouped lists, one accent, glass only where something
floats over content — and nothing on the screen that is there to decorate.

- **Native.** The system font, iOS text styles, inset grouped lists with hairlines,
  segmented controls, sheets with a grabber, a large title that turns into a compact
  glass bar as the page scrolls. If iOS has a convention for it, use the convention.
- **Neutral.** True white and near-black surfaces in layered greys. Colour is rare, so
  when it appears it means something: the accent is the one thing to tap, the macro
  colours are the macros, clay is "over".
- **Flat.** Hierarchy comes from grey layers, spacing and type weight — not shadows,
  borders around everything, gradients or tinted boxes. One level of surface per region.
- **Numbers first.** Tabular figures everywhere a number changes or lines up; the rings
  are Apple's activity rings, simplified — no glow, no gradient.
- **Phone first.** One column, at most 34rem, the same on a desktop. Everything a thumb
  needs sits in the lower two thirds; the "+" is always one tap away.

**What it is not.** No illustrations or hero art, no sparkles or "magic" icons, no glow
blobs or gradient washes, no gradient text, no serif display type, no emoji-like
ornament, no badge or pill on every count, no cards inside cards, no heavy shadows, no
oversized "bubbly" corners. Copy is plain and short — say what it is, not how delightful
it is.

## Colour

Every colour is a token. Pages use the semantic names (`text-primary`, `bg-protein`,
`text-warning`, `bg-cell`), never a raw palette step, so light and dark stay in step.

### Palettes (`@theme static` in main.css)

| Scale | Role | Light | Dark |
| --- | --- | --- | --- |
| `basil` | **the accent** — actions, links, selection, success, kcal | ink/fill `600` `#1d7f43` (5.0:1 on white), ring `500` `#2fb463` | `400` `#4cd07a` |
| `graphite` | neutral: text, separators (Apple's greys) | — | — |
| `clay` | warning: over a target | `600` `#c75306` | `400` `#f38651` |
| `rose` (Tailwind) | error, destructive | `600` | `400` |
| `teal` (Tailwind) | info — and water | `700` `#0f766e` | `400` |

Nuxt UI mapping (`app.config.ts`): `primary: basil`, `success: basil`, `warning: clay`,
`error: rose`, `info: teal`, `neutral: graphite`. In light mode the coloured tokens point
one step darker than Nuxt UI's default so coloured text passes AA on white and on the
canvas; in dark mode at 400.

**One accent.** Basil is the only colour that says "tap here" — buttons, links, the
selected tab, a switch that is on, the "+". Never a second accent for variety.

### Surfaces — iOS's layers

| Token · utility | Light | Dark | Used for |
| --- | --- | --- | --- |
| `--app-canvas` · `bg-canvas` | `#f2f2f7` | `#000000` | the page behind grouped content (iOS grouped background) |
| `--app-cell` · `bg-cell` | `#ffffff` | `#1c1c1e` | cards and list groups on the canvas; inside a sheet it steps to `#f2f2f7` / `#2c2c2e` by itself, and on a plain screen (`.app-on-plain`) to `#f2f2f7` / stays `#1c1c1e` |
| `--ui-bg` · `bg-default` | `#ffffff` | `#1c1c1e` | sheets, modals, popovers |
| `--app-plain` · `bg-plain` | `#ffffff` | `#000000` | a screen without groups: sign-in, sign-up, onboarding |
| `--ui-bg-elevated` · `bg-elevated` | grey 12 % | grey 24 % | fills: input fields, segmented track, wells, pressed rows |
| `--ui-bg-accented` · `bg-accented` | grey 20 % | grey 32 % | a stronger fill: a switch's track, a row being pressed |
| `--app-separator` · `bg-separator` | `rgb(60 60 67 / 29%)` | `rgb(84 84 88 / 60%)` | hairlines between rows, under bars |
| `--ui-border` · `border-default` | `rgb(60 60 67 / 13%)` | `rgb(84 84 88 / 45%)` | the rare 1 px border Nuxt UI draws |

The fills are translucent on purpose (iOS's `tertiarySystemFill`): the same field reads
right on white, on the grey canvas and on a sheet.

Text: `text-highlighted` (titles, numbers that matter — black / white), `text-default`
(body, `#1c1c1e` / `#ebebf0`), `text-muted` (secondary, `#6e6e73` / `#98989d`, ≥ 4.5:1
on white and on the canvas), `text-dimmed` (placeholders, chevrons, "—", never the only
carrier of meaning).

### The diary's own colours — one per question, everywhere

Kept apart from each other, but quieter than before — a step less saturated, so four of
them on one screen don't shout.

| Token | Fill (bars, rings, dots) light / dark | Ink (small text) light / dark |
| --- | --- | --- |
| `kcal` | `#2fb463` / `#4cd07a` (the accent) | `#1d7f43` / `#4cd07a` |
| `protein` | `#4a8fe7` / `#62a3f5` | `#2563c9` / `#62a3f5` |
| `carbs` | `#8e7ce8` / `#a598f5` | `#6a55d4` / `#b1a6f7` |
| `fat` | `#e9a23b` / `#f2b65a` | `#9c5c00` / `#f2be6b` |

Utilities: `bg-protein`, `text-protein-ink`, `stroke-protein`, `bg-protein/15` (tracks),
and the same for `kcal`, `carbs`, `fat`. Raw values for SVG or inline styles:
`var(--app-protein)`, `var(--app-protein-ink)`.

- A value **within** its target keeps its own colour. **Over** the target, the fill
  turns `warning` (clay) — the same rule for kcal and for each macro.
- A **day** is coloured by how it went: within target `kcal`, over `warning`, nothing
  written down `bg-elevated` with "—".
- **Water** is `info` (teal) for its glyphs and words; its chart columns take
  `--app-water` (`#14a89a` / `#2dd4bf`), lighter than the ink, so a water chart weighs no
  more than the kcal chart. **Weight** has no colour of its own: the number in
  `text-highlighted`, the change in `text-muted`.
- Macro colours appear only as small marks — a ring, a bar, a dot, a letter. Never a
  macro colour for anything that is not that macro, and never a tinted background box.

## Type

**The system font, never an embedded one.** `--font-sans` is
`-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, Roboto, "Segoe UI",
sans-serif`: San Francisco on Apple devices, Roboto on Android, Segoe on Windows. SF is
never shipped as a file (its licence covers Apple platforms only); `@nuxt/fonts` finds
nothing to download. `font-rounded` (`ui-rounded`, SF Pro Rounded on Apple, the system
face elsewhere) is for the one big number on a screen and stat values only — the way
Fitness and Health set their numbers.

iOS's text styles, with Apple's tracking. Line heights are the iOS ones; sizes are
`rem`, so the browser's text-size setting still scales them.

| Utility | Size / line · weight · tracking | iOS style · use |
| --- | --- | --- |
| `text-large-title` | 34 / 41 · 700 · +0.004em | Large Title · the page title in the app bar, auth titles |
| `text-title` | 28 / 34 · 700 · +0.007em | Title 1 · a sheet's hero number, a big heading |
| `text-title2` | 22 / 28 · 700 · +0.01em | Title 2 · a prominent section heading |
| `text-title3` | 20 / 25 · 600 · +0.01em | Title 3 · empty-state titles, a stat value |
| `text-headline` | 17 / 22 · 600 · −0.022em | Headline · card titles, sheet titles, the compact bar title |
| `text-body` | 17 / 22 · 400 · −0.022em | Body · row titles, food names, form text |
| `text-callout` | 16 / 21 · −0.02em | Callout · descriptions under a title |
| `text-subheadline` | 15 / 20 · −0.016em | Subheadline · secondary values, buttons, field labels |
| `text-footnote` | 13 / 18 · −0.006em | Footnote · section headers and footers, row subtitles, meta lines |
| `text-caption` | 12 / 16 | Caption 1 · macro lines, small labels |
| `text-caption2` | 11 / 13 · +0.005em | Caption 2 · units under a number, column heads |
| `text-hero` | 44 / 1.05 · 700 | the one big number on a screen (with `font-rounded`) |

`text-micro` (10 px) is kept only for the column heads that still use it.

- Weights: 400 for reading, 600 for headlines and buttons, 700 for titles and big
  numbers. Row titles are **regular**, not semibold — iOS lists are.
- `tabular-nums` on every number that sits in a column or changes in place.
- Section headers are `text-footnote uppercase text-muted` (the `.app-group-title`
  helper); the eyebrow over a page title is the same at weight 600.
- Inputs are 16 px on touch screens whatever their size, so iOS never zooms into a field
  (main.css, `@media (pointer: coarse)`).

## Space and shape

- **Spacing** on a 4 / 8 pt grid. Page gutter `px-4` (16). Inside a group, rows are
  `px-4`, at least 44 tall (`py-2.5` around one line, more for two). Card padding `p-4`.
  Between groups `gap-4`–`gap-6`; a section's header sits `6` above its group and its
  footer `6` below.
- **Radii — small and consistent.** `--ui-radius: 0.25rem`, so Nuxt UI's scale runs
  `rounded-md` 6 · `rounded-lg` 8 · `rounded-xl` 12. Named radii:
  `rounded-card` 12 (groups, cards, tiles), `rounded-tile` 10 (wells, small tiles),
  `rounded-control` 10 (buttons and inputs, md), `rounded-sheet` 14 (sheets, modals).
  `rounded-full` only for things that are round by nature: icon-only buttons, the "+",
  avatars, switches, chips, the tab bar capsule.
- **Separators** are hairlines: `--app-hairline` is 0.5 px on a retina screen and 1 px
  elsewhere, in `--app-separator`. Between rows they start where the text starts (16 px
  in, or 52 px when the row has an icon) and run to the edge — `.app-divide` draws them.
  Don't put a border around a group: white on the grey canvas is the edge.

## Materials — glass

Glass is for chrome that floats over content: the **tab bar**, the **compact nav bar**
once the page scrolls under it, a **sheet's header and footer** when its body scrolls
under them, **toasts** and **menus**. Nothing else — cards and lists are opaque.

| Token | Light | Dark |
| --- | --- | --- |
| `--app-material` (`bg-glass`) | `rgb(250 250 252 / 72%)` | `rgb(30 30 32 / 70%)` |
| `--app-blur` | `blur(20px) saturate(180%)` | same |
| `--app-glass-border` | `rgb(0 0 0 / 7%)` | `rgb(255 255 255 / 9%)` |

`.app-glass` is the whole recipe (tint + `backdrop-filter`); in Nuxt UI slots it is
`bg-glass backdrop-blur-glass backdrop-saturate-180`. **Fallbacks:** where
`backdrop-filter` is unsupported, and under `prefers-reduced-transparency: reduce`,
`--app-material` itself turns opaque (`#f7f7f9` / `#1c1c1e`), so every glass surface
becomes a solid bar without a separate rule.

## Elevation

Almost none. Surfaces are told apart by their grey, not by shadows.

- `shadow-card` — **none**. Cards and groups sit flat on the canvas.
- `shadow-raised` — the floating tab bar only: a soft, wide, faint shadow so the glass
  separates from what is under it.
- `shadow-overlay` — menus, popovers, toasts, modals: one soft shadow, no more.
- `shadow-fab` — none (kept so old classes resolve; the "+" is flat).

Sheets cast no shadow; the scrim (`--app-scrim`, black 25 % / 50 %) does the work.

## Motion

Short, purposeful, spring-like; nothing moves to entertain.

| Token | Value | Use |
| --- | --- | --- |
| `duration-120` | 120 ms | press feedback, something leaving |
| `duration-200` | 200 ms | colour and state changes, the bar's material, the compact title |
| `duration-300` | 300 ms | something arriving: a row, a panel, a day sliding in, a sheet |
| `duration-700` | 700 ms | something filling: rings, bars, chart columns, counting numbers |
| `ease-soft` | `cubic-bezier(0.22, 1, 0.36, 1)` | the default: fast out, gentle landing |
| `ease-spring` | a damped spring (`linear()`, ~2 % overshoot; a cubic-bezier where `linear()` isn't supported) | small UI only: the tab highlight, the segmented thumb, the "+" |
| `animate-rise` | 240 ms, 4 px rise and fade | a page's content arriving (`.app-page-in`) — once, no stagger |

Presses: buttons scale to 0.98; rows don't scale, they highlight (`active:bg-accented`),
the way iOS cells do. The named transitions live in `assets/css/motion.css`: `list`,
`page`, `panel`, and `.day-from-next` / `.day-from-prev` for Today's day slide.

Everything that moves respects `prefers-reduced-motion`: main.css and motion.css switch
animations and transitions off, utilities carry `motion-reduce:transition-none` or
`motion-safe:animate-*`, script checks `useReducedMotion()`, and bottom sheets appear
instead of sliding (1 ms, not none — the drawer waits for its animation to end).
Spinners keep spinning: they say "still working", which nothing else does.

## Icons

Lucide (`i-lucide-*`) only, 2 px stroke as shipped — the closest open set to SF Symbols.
`size-5` (20) in buttons and rows, `size-4` (16) inline with text, `size-6` (24) in the
tab bar and the "+". An icon is a plain glyph in `text-muted` (or the accent when it is
the action) — never sitting on a tinted tile or a circle badge. An icon without a visible
word carries an `aria-label`. Diary meanings: `flame` kcal, `beef` protein, `wheat` carbs,
`droplet` fat; `coffee` / `salad` / `utensils` / `apple` for breakfast / lunch / dinner /
snack (the `SLOTS` list in `useEating`); `scan-barcode`, `mic`, `search`, `book-open`
(recipes). Tabs: `notebook-pen` Today, `chef-hat` Library, `chart-no-axes-column`
Progress, `settings` Settings. **No `sparkles`, `wand`, `stars` or similar** as ornament.

## Touch, safe areas, scrolling

- **44 px minimum** for anything tapped on its own: `md` buttons and inputs are 44, `lg`
  48, `xl` 56; tab bar items fill a 56 px bar. `xs`/`sm` buttons (28/32) live only inside
  rows that are themselves the target, or get `.app-hit` (an invisible 44 px hit area).
- **No hover-only anything**; hover styles are a bonus for mouse users. Pressed states
  (`active:`) give the feedback a finger needs.
- **Safe areas**: the page runs under the notch and the home indicator
  (`viewport-fit=cover`); anything pinned to an edge pads itself with
  `.app-safe-top` / `.app-safe-bottom` or `env(safe-area-inset-*)`.
- **Scrolling** is the window's own (momentum, Safari's collapsing bars). The nav bar is
  sticky, the tab bar fixed; `scroll-padding` keeps a focused field clear of both.
  Horizontal strips use `.app-scroll-x` (snap, no scrollbar, edge fade).
- `--app-tabbar-space` is how much room the tab bar takes at the bottom — use it for
  anything that must clear it (a sticky action bar, a toast offset).
- **Layers**: nav bar and its toolbar `z-30`, tab bar `z-40`, everything that floats —
  sheets, modals, slideovers, menus, popovers, tooltips — `z-50` (set once in
  `app.config.ts`), the confirm dialog `z-[60]`, toasts `z-[100]`. Don't invent others.

## The shell

```
┌──────────────────────────────┐
│ ‹                     ⋯   ⊕ │  ShellAppBar — the 44 px bar: back, actions.
│ SATURDAY 3 OCTOBER           │  Transparent at rest; glass once the page scrolls.
│ Today                        │  Large title (34 bold) under it, scrolling away…
│ [ Week | 30 days | 90 days ] │  #toolbar sticks under the bar once the title is gone
├──────────────────────────────┤
│ ╭──────────────────────────╮ │
│ │ row                    › │ │  grouped lists on the grey canvas
│ │ row                    › │ │
│ ╰──────────────────────────╯ │
│  ╭────────────────────────╮  │  ShellBottomTabBar — a floating glass capsule,
│  │ Today Library ⊕ Prog Set│  │  the "+" a flat accent circle in the middle
│  ╰────────────────────────╯  │
└──────────────────────────────┘
          ↓ scrolled
┌──────────────────────────────┐
│ ‹          Today       ⋯   ⊕ │  compact glass bar: the title in 17 semibold,
│ [ Week | 30 days | 90 days ] │  centred; a hairline under the bar (or the toolbar)
```

- `layouts/default.vue` — the grey canvas, the 34rem column padded for the tab bar, then
  `ShellBottomTabBar`, `QuickAddSheet`, `ConfirmDialog` (each mounted once). No wash.
- `ShellAppBar` — iOS's large-title navigation bar. The 44 px bar holds the back
  chevron, the compact title (hidden until the large title has scrolled under it) and the
  actions. With nothing in the bar the large title tucks up under it, so a screen without
  bar items doesn't start with an empty strip. `compactTitle` names the compact bar when
  `#heading` replaces the large title (Today: the day's name).
- `ShellBottomTabBar` — Today · Library · [+] · Progress · Settings, a glass capsule
  floating over the home indicator. The selected tab is the accent, with a faint grey
  capsule behind it; the others are `text-muted`. The "+" is a 44 px flat accent circle
  in line with the tabs — no glow, no ring, not raised. While a text field has focus on a
  touch screen the bar slides away, so it never sits on top of the keyboard.
- `layouts/auth.vue` — `/login`, `/register`, `/onboarding`, `/auth/callback`: a plain
  white (black) screen, the wordmark top left and the theme toggle top right, the form in
  a narrow column with plenty of air, the tagline as a footnote at the bottom. No
  illustration.

## Building blocks (`components/shell/`)

Each file documents its props at the top. Auto-imported with the `Shell` prefix.

| Component | What it is | Main props / slots |
| --- | --- | --- |
| `ShellAppBar` | large title + compact glass bar | `title`, `eyebrow?` (today's date by default; `''` hides it), `back?`, `compactTitle?`; `#heading`, `#actions`, `#toolbar` |
| `ShellBottomTabBar` | the glass tab bar with the "+" | — |
| `ShellList` | **an inset grouped list** (iOS Settings): rows on one rounded surface, inset hairlines between them, a small header above and a footnote under it | `title?`, `description?` (the footnote), `plain?` (edge to edge, no surface — a list filling a sheet); `#actions` (right of the header), default = `ShellListRow`s |
| `ShellListRow` | one row of a list: glyph, title, subtitle, trailing value or control, chevron | `title`, `subtitle?`, `icon?`, `tone?` (the glyph's colour; `error` reddens the title), `to?`, `plain?`, `chevron?`, `disabled?`; `#leading`, `#subtitle`, `#trailing` |
| `ShellSection` | a titled group of anything — cards, a form, a chart | `title?`, `description?` (a footnote under the content), `prominent?` (a bold Title 2 heading instead of the small caps one); `#actions` |
| `ShellCard` | a surface for content that isn't a plain list: the day's rings, a chart, a form, a meal slot with its rows | `title?`, `icon?`, `iconClass?`, `count?` (plain muted number, no pill), `hint?`, `flush?` (rows edge to edge with inset hairlines), `tone?: 'default' \| 'muted'` (`brand` is accepted and looks like `default`), `to?`, `loading?`, `isEmpty?`, `empty?`; `#actions`, `#header`, `#empty`, `#footer` |
| `ShellMacroRing` | concentric activity rings (kcal outside, macros in) | `tracks: { key, value, goal }[]` (type `RingTrack`), `size?` (208), `thickness?`, `label?`; default slot = the centre |
| `ShellMacroBar` | one macro against its target: label, `used / goal`, bar | `macro`, `value`, `goal`, `label?`, `unit?`, `compact?` |
| `ShellMacroLine` | "P 24 · C 30 · F 8 · 320 kcal" — the letters in the macro inks, the numbers muted | `macros`, `kcal?: boolean`, `size?` |
| `ShellStatTile` | one number with its label and context, the number in `font-rounded` | `label`, `value`, `unit?`, `hint?`, `macro?`, `icon?`, `tone?: 'card' \| 'well' \| 'warning'` (`brand` looks like `card`), `size?`; `#value` |
| `ShellSegmented` | iOS segmented control with a sliding thumb | `v-model`, `options: { value, label, icon? }[]`, `label?`, `size?: 'sm' \| 'md'` |
| `ShellFieldRow` | one value edited inline in a group, Health's way: label left, the number right-aligned against its unit; the whole row focuses the field | `label`, `unit?`, `dot?` (a macro's colour class), `wide?` (text, such as a name); default slot = a `UInput variant="none"` with `:ui="FIELD_ROW_INPUT"` |
| `ShellEmpty` | an empty state: a glyph, a title, one sentence, the button that does it | `icon?`, `title`, `description?`, `compact?`; default slot = actions |
| `ShellSkeleton` | placeholders shaped like the content, gently pulsing | `variant: 'rows' \| 'card' \| 'ring' \| 'tiles' \| 'text'`, `count?` |
| `ShellLogoMark` / `ShellLogo` | the mark (one colour, follows the theme) / mark + wordmark | `ShellLogo`: `size?`, `to?` |

**Which to use.** A list of things to tap or toggle — settings, menus, a list of foods
or recipes — is a `ShellList` of `ShellListRow`s (or of the page's own rows inside it). A
region that holds something other than rows — the rings, a chart, a form, a meal slot
whose header carries buttons — is a `ShellCard`. Several cards under one heading are a
`ShellSection`. Never a `ShellCard` inside a `ShellCard`, or a list group inside a card.

### Helpers in main.css

| Class | What it is |
| --- | --- |
| `.app-glass` | the glass material (tint + blur + saturate, opaque fallback) |
| `.app-card` | a cell surface: `bg-cell`, `rounded-card`, no border, no shadow |
| `.app-divide` | inset hairlines between a container's children (`--app-divide-inset`, 16 px by default; a `ShellListRow` with an icon sets 52 px) |
| `.app-rule-t` / `.app-rule-b` | one inset hairline above / below an element |
| `.app-group-title` | a grouped section header: footnote, uppercase, muted |
| `.app-field` | a native date or time `<input>` dressed as a `UInput` (44 px, grey fill, accent focus ring); Chrome's clock and calendar glyph sits close, so a compact time field never clips "08:30" |
| `.app-chip` | one choice among a few, or a shortcut — an amount, a period: a grey capsule, the chosen one filled with the accent (`aria-pressed` / `aria-checked`) |
| `.app-chip-quiet` | with `.app-chip`, for a choice repeated on every row of a list (a reminder's weekdays): the chosen ones a grey fill with the strong text, the rest plain dimmed letters — seven accent discs a row would turn the list green |
| `.app-hit` | a small control keeps its looks but gets a 44 px hit area |
| `.app-press` | press feedback (0.98) for anything tappable that isn't a `UButton` or a row |
| `.app-eyebrow` | the small uppercase line over a page title |
| `.app-sheet` | set on every drawer's content (app.config): groups inside it step one layer up |
| `.app-on-plain` | set on the auth layout: groups on a plain white screen step to grey the same way |

## Patterns

- **A list row** — the name first, regular weight, and it may wrap to two lines
  (`line-clamp-2`): Serbian food names run long. Under it, one quiet line — a
  `ShellMacroLine`, the brand, the minutes. On the right, the kcal in one fixed column
  (`w-14` or `w-16`, `tabular-nums`, the unit in `text-caption2` under it) so the numbers
  line up down the list. Then at most one control or a chevron. At least 44 px tall.
- **An editable item** is two lines: the name across the full width with ✕ at the end,
  then amount · unit · what it comes to, right-aligned. Never four inputs on one line.
- **A value in a list** — a target, the water goal, a name — is a `ShellFieldRow`: edited
  where it stands, right-aligned against its unit. A form that saves explicitly shows its
  Save button only once something has changed (Settings); a quick action that belongs to
  the group is an accent text row in it ("Split the kcal into macros").
- **One of a few** — a period, an activity level, a goal — is a grouped list with a
  plain glyph and a checkmark (`i-lucide-check`, accent) on the chosen row,
  `role="radio"` on each.
- **Group headers** carry a count in the title ("2 recipes", "On the plate · 3",
  "Ingredients · 4") and, on the right, what the number column means ("kcal · per 100 g
  or ml") — never a pill.
- **A sub-panel inside a sheet** (the amount, quick kcal, copying a day) steps back with
  an accent `i-lucide-chevron-left` before its own headline, the way a pushed screen does.
- **A list inside a sheet** is a `ShellList` (it steps to the sheet's group colour by
  itself), or `plain` when it fills the sheet. No bordered boxes.
- **A sheet** has a grabber, a title (headline) and one line of description in a header
  that turns to glass when the body scrolls under it. The footer is a quiet `Cancel`
  (ghost, lg) and the one thing the sheet is for, filling the rest (lg, `flex-1`).
  Destructive actions are an icon on the left of the footer, never the big button.
- **A choice of two to four** in place is `ShellSegmented`; more, or labels that won't
  fit, are `.app-chip`s that wrap; a few with an explanation each are a `ShellList` with
  a checkmark on the chosen row.
- **Empty** is a `ShellEmpty`: the full one when a whole screen or group has nothing,
  `compact` inside a group or a sheet. An empty meal slot is just its card's header.
- **Loading** keeps the layout: `ShellSkeleton` shaped like what's coming. A refetch dims
  what is there rather than flashing skeletons.
- **Errors** say what happened and offer the way out: a toast for an action that failed
  (with the API's own words), a `ShellEmpty` with "Try again" for a screen that didn't
  load, the error page in the app's own look.
- **Notes** (`UAlert`, `soft` or `subtle`) are a grey well with ordinary text; only the
  glyph — and an error's title — carries the colour that says why (app.config). Never a
  tinted box.
- **No required asterisk.** The forms that would carry one (sign-in, sign-up) need
  every field, so a red star says nothing; a missing value is named under its field.
- **A glyph after a title that wraps** (a meal's mic and chevron) is glued to the last
  word with a word joiner in a `whitespace-nowrap` span, so a chevron never sits alone on
  a line of its own.
- **Colour repeated down a list is noise.** Something every row has — a reminder's
  glyph, its weekdays — is grey; the accent is left for the one control per row that
  says "on" (the switch).
- **Fields keep one size at every width.** Nuxt UI shrinks field text from 768 px up; the
  column is a phone everywhere, so app.config undoes that, and a field set large on
  purpose (the amount, the quick kcal) says `fixed`.
- **Toasts** are glass banners at the top, under the notch; anything undoable carries
  Undo and a faint timer line.
- **Counts and states** are plain text (`text-muted tabular-nums`), not pills. A badge is
  for the rare state that must stand out (a demo account), never for a number.
- **Dark mode** is its own design, not an inversion: black canvas, `#1c1c1e` groups,
  `#2c2c2e` groups in sheets, lighter accent and inks; the segmented thumb is `#636366`.

## Screens

- **Today** — the large title names the day ("Today", "Yesterday", a weekday) under the
  full date, with an accent chevron: tapping it opens the date picker; the compact bar
  says the same. The bar carries an accent "Today" (on another day) and "⋯" (targets,
  export). The week strip: seven small kcal rings, the chosen day on a grey fill, today's
  letter in the accent. The day's rings in a plain card — kcal left in the middle, eaten
  and target either side, all in `font-rounded`; the four rings are 180 px with 8 px
  strokes 2 px apart, which leaves a 104 px hole a four-digit number at 34 px clears
  (172 / 9 / 3 left 82 px, and "1 572" ran into the fat ring) — then one card per meal slot: a header
  (glyph, name, kcal, an accent "Repeat" and "+"), and rows of time (footnote) · name
  (regular, two lines) over its macro line · kcal · ⋯. "Fill in" is accent text. A meal
  opens onto its items on a faint well. Swipe actions are solid (red delete, accent copy).
  Water: the glasses as plain glyphs (44 px targets, no tiles) — teal when drunk,
  dimmed when not — over one row of grey buttons; "Goal reached" as plain teal words. Weight: the number in `font-rounded`, the week's change as plain muted
  text. A day that didn't load is a compact `ShellEmpty` with Try again.
- **The "+" sheet** — the slot as a small segmented control, the search field, the six
  ways in as a row of equal accent buttons (a contact card's message · call · mail),
  "Repeat yesterday's …" as one accent row, then Starred and Recent as grouped lists of
  food rows (name, the amount the "+" adds again, the macro line, kcal per 100, a star
  and a tinted round "+").
- **Form sheets** — meal (the five ways as one segmented control, the plate as a group
  headed "On the plate · n" with its total as the last row), recipe (the kcal in
  `font-rounded` on a well, ingredients and plain numbered steps as groups), food,
  export (a checkmark list), move, targets (`ShellFieldRow`s), keep the demo.
- **Library** — Recipes / Foods as a segmented control and the search field in the
  toolbar, pinned under the compact bar; the "+" is an accent glyph in the bar; one
  grouped list per shelf under a header with the count and what the kcal column means.
- **Progress** — Week / 30 / 90 days in the toolbar; four stat tiles; one card per
  chart (hairline gridlines in the separator grey, muted 10 px axis labels, a dashed
  target, a glass callout on touch); "Day by day" as a section of rows with a kcal bar.
- **Settings** — iOS Settings: the profile group first (avatar, name, email, the name
  inline), then grouped lists with small-caps headers and footnotes — daily targets (with
  the calculator as a row), water, reminders, appearance (the theme as a segmented
  control), your data, account; delete account is the one red row. No eyebrow. A
  reminder is a muted glyph, its name, the time and a switch, with its weekdays as
  quiet chips under them; the switch is the only accent in the row.
- **Sign-in, sign-up, onboarding** — the auth layout: a large title, grey fields, one
  accent button; the demo is a plain secondary button under a rule. The goal calculator
  (onboarding and Settings) is checkmark lists for activity and goal, the day as one big
  `font-rounded` number on a well, and the macros as stat tiles.

## The mark and the icons

The mark is the day's ring — three quarters closed — with a leaf growing where the day
starts: the same ring Today fills, and, read small, a fruit with a leaf. One colour:
the accent on light, the light accent on dark, white on the accent tile. No gradient.

`scripts/make-icons.py` holds the geometry and writes `public/logo.svg`,
`public/favicon.svg` and `public/icons/` (`icon-192.png`, `icon-512.png` rounded tiles;
`maskable-512.png` full bleed with the mark inside the 80 % safe circle;
`apple-touch-icon.png` 180 × 180, opaque). Re-run it after changing the mark:

```bash
../nutrijurnal-back/.venv/bin/python scripts/make-icons.py
```

`components/shell/LogoMark.vue` carries the same paths for use inside the app.

PWA colours for the manifest and `<meta name="theme-color">`: `#f2f2f7` (the light
canvas); dark `#000000`.

## Rules of thumb

- One accent. Colour must answer a question; if it doesn't, it's grey. If the same
  coloured thing repeats on every row, it has stopped answering one.
- Numbers: `tabular-nums`, thin-space thousands (`formatKcal`), the unit smaller and
  muted after the number. Every number has context — "of 2 300", "left".
- Hierarchy by type weight and grey layers, not by boxes, borders or shadows.
- One surface per region: inside a card, use hairlines and `bg-elevated` wells.
- Empty is an invitation: say what to do next and offer the button that does it.
- No `sm:`/`md:` breakpoints inside the column; no hover-only actions.
- If it would look at home in a template gallery — a gradient, a glow, a sparkle, a
  cute line of copy — it doesn't belong here.
