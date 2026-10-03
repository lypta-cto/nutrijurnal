# Design

How Nutrijurnal looks, feels and moves — the decisions first, then the tokens that carry
them, then the shell and the building blocks every screen is made of. The tokens live in
`app/assets/css/main.css`, the Nuxt UI theme in `app/app.config.ts`, the building blocks
in `app/components/shell/`.

## Direction

**A kitchen notebook in morning light.** Nutrijurnal is opened three to six times a day,
usually with one hand, often with food nearby. It should feel like a calm, well-made
notebook — fresh, warm, food-friendly — never like a lab report or a gym.

- **Fresh.** One leafy green carries the brand; plenty of air; white cards on a warm
  cream canvas.
- **Warm.** Warm greys instead of blue-greys, a soft serif for titles, rounded shapes,
  and nothing harsher than it needs to be — going over a target turns clay, not red.
- **Calm.** One accent at a time. Colour always means something (a macro, a state), and
  the same thing has the same colour on every screen. Numbers come with context.
- **Food-friendly.** Food names (Serbian data) are shown exactly as written, in a face
  that handles č ć š ž đ well, at a size that is read at arm's length.
- **Phone first.** One column, at most 34rem, the same on a desktop. Everything a thumb
  needs sits in the lower two thirds; the "+" is always one tap away.

What it is not: a dashboard, a spreadsheet, a gamified streak machine. The CTO app's
ledger-sheet habit stays where it helps — lists keep one shared grid so numbers line up
down a column — but here it is softer: bigger rows, more air, rings and bars before
tables.

## Colour

Every colour is a token. Pages use the semantic names (`text-primary`, `bg-protein`,
`text-warning`, `bg-elevated`), never a raw palette step, so light and dark stay in step.

### Palettes (`@theme static` in main.css)

| Scale | Role | 500 | Light-mode ink |
| --- | --- | --- | --- |
| `basil` | brand, success, kcal | `#3eb268` | `600` `#307e4b` (5.0:1 on white) |
| `oat` | neutral: canvas, text, borders (warm grey) | `#706d67` | `500` (4.6:1 on canvas) |
| `clay` | warning: over a target, attention | `#e56b29` | `600` `#c75306` (4.5:1) |
| `rose` (Tailwind) | error, destructive | `#f43f5e` | `600` |
| `teal` (Tailwind) | info — and water | `#14b8a6` | `700` `#0f766e` |

Nuxt UI mapping (`app.config.ts`): `primary: basil`, `success: basil`, `warning: clay`,
`error: rose`, `info: teal`, `neutral: oat`. In light mode `--ui-primary` /
`--ui-success` / `--ui-warning` / `--ui-error` point at step 600 (`--ui-info` at 700) so
coloured text passes AA; in dark mode at 400.

### Surfaces

| Token | Light | Dark | Used for |
| --- | --- | --- | --- |
| `--app-canvas` · `bg-canvas` | `#f8f5f1` cream | `#0f0e0c` | the page, the app bar at rest |
| `--ui-bg` · `bg-default` | `#ffffff` | `#1b1916` | cards, sheets, the tab bar |
| `--ui-bg-elevated` · `bg-elevated` | `#f4f2ee` | `#24231f` | tracks, wells, pressed rows, segmented controls |
| `--ui-bg-accented` · `bg-accented` | `#e9e6e0` | `#302e29` | empty bar tracks on elevated |
| `--ui-border` · `border-default` | `#e9e6e0` | `#292724` | hairlines between rows and around cards |

Text: `text-highlighted` (titles, numbers that matter), `text-default` (body),
`text-muted` (secondary, ≥ 4.5:1), `text-dimmed` (placeholders, "—", never the only
carrier of meaning).

### The diary's own colours — one per question, everywhere

| Token | Fill (bars, rings, dots) light / dark | Ink (small text) light / dark |
| --- | --- | --- |
| `kcal` | basil-500 `#3eb268` / basil-400 `#65cc85` | `#307e4b` / `#65cc85` |
| `protein` | sky `#0ea5e9` / `#38bdf8` | `#0370ab` / `#38bdf8` |
| `carbs` | violet `#8b5cf6` / `#a78bfa` | `#7c3aed` / `#a78bfa` |
| `fat` | amber `#f59e0b` / `#fbbf24` | `#b45309` / `#fbbf24` |

Utilities: `bg-protein`, `text-protein-ink`, `stroke-protein`, `bg-protein/15` (tracks),
and the same for `kcal`, `carbs`, `fat`. Raw values for SVG or inline styles:
`var(--app-protein)`, `var(--app-protein-ink)`.

- A value **within** its target keeps its own colour. **Over** the target, the fill
  turns `warning` (clay) — the same rule for kcal and for each macro.
- A **day** is coloured by how it went: within target `kcal`, over `warning`, nothing
  written down `bg-elevated` with "—".
- **Water** is `info` (teal: `text-info`, `bg-info/15`) — never sky, which is protein's.
  **Weight** has no colour of its own: the number in `text-highlighted`, the change
  in `text-muted` (a lost or gained kilo is not good or bad news to colour).
- Never use the macro colours for anything that is not that macro (no violet buttons,
  no sky links). Links and actions are `primary`.

## Type

Two families, both picked up by `@nuxt/fonts` from the `font-family` tokens (no
`nuxt.config` change needed):

- **Plus Jakarta Sans** — `font-sans`, everything by default. Friendly, open, very
  legible at 11 px, full Latin Extended (č ć š ž đ), true tabular figures
  (`tabular-nums` on every number that sits in a column or changes in place).
- **Fraunces** — `font-display`, a soft "old-style" serif with warmth. Page titles, the
  wordmark, the auth hero headline and empty-state titles only. Never for numbers,
  never below 17 px.

| Utility | Size / line | Use |
| --- | --- | --- |
| `text-hero` | 44 / 1, −0.035em, 700 | the one big number on a screen (kcal left, average) |
| `text-title` | 28 / 1.15, −0.02em | page title in the app bar (`font-display`) |
| `text-headline` | 17 / 1.4 | card and section titles (`font-semibold`) |
| `text-body` | 15 / 1.45 | row titles, food names, form text |
| `text-sm` | 14 / 20 | supporting text, buttons |
| `text-xs` | 12 / 16 | meta lines, pills |
| `text-caption` | 11 / 1.35 | macro lines, tab labels, eyebrows (`uppercase tracking-[0.08em]` for eyebrows) |
| `text-micro` | 10 / 1.3 | column heads only |

Inputs are 16 px on touch screens whatever their size, so iOS never zooms into a field
(main.css, `@media (pointer: coarse)`).

## Space, shape, depth

- **Spacing** on a 4 px grid. Page gutter `px-4` (16). Card padding `p-4`; list rows
  `px-4 py-3`. Between cards `gap-3` (12); between sections `gap-6` (24).
- **Radii** — `--ui-radius: 0.3125rem`, so Nuxt UI's scale runs `rounded-md` 7.5 ·
  `rounded-lg` 10 · `rounded-xl` 15 · `rounded-2xl` 20. Named radii:
  `rounded-card` 20 (cards), `rounded-tile` 16 (tiles, wells), `rounded-control` 14
  (buttons and inputs, md and up), `rounded-sheet` 28 (bottom sheets, modals),
  `rounded-full` (pills, chips, the "+", avatars).
- **Elevation** — four steps, warm-tinted shadows in light mode, none in dark mode
  (surfaces get lighter instead, with a hairline):
  - `shadow-card` — resting cards (with `ring-1 ring-default` / `border-default`)
  - `shadow-raised` — the tab bar, the app bar once the page scrolls, floating buttons
  - `shadow-overlay` — sheets, modals, menus
  - `shadow-fab` — the "+" only: a soft brand-coloured glow
- **Glass** — `.app-glass`: translucent canvas + blur + saturate, for chrome that floats
  over scrolling content (app bar when scrolled, tab bar).

## Motion

Quick, soft, never bouncy on data.

| Token | Value | Use |
| --- | --- | --- |
| `duration-120` | 120 ms | press feedback (`active:scale-[0.97]`) |
| `duration-200` | 200 ms | colour and state changes, app bar material |
| `duration-300` | 300 ms | enter animations, the tab indicator, sheets |
| `duration-700` | 700 ms | rings and bars filling to a new value |
| `ease-soft` | `cubic-bezier(0.22, 1, 0.36, 1)` | the default: fast out, gentle landing |
| `ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | small UI only: the tab pill, the "+" |
| `animate-rise` | 320 ms rise-and-fade | content arriving (`.app-page-in` staggers children) |

Everything that moves respects `prefers-reduced-motion` (main.css switches the
animations and the ring/bar transitions off).

## Icons

Lucide (`i-lucide-*`) only, 2 px stroke as shipped. `size-5` (20) in buttons and tabs,
`size-4` (16) inline with text, `size-6` (24) in the "+" and empty states. An icon
without a visible word carries an `aria-label`. Diary meanings: `flame` kcal,
`beef` protein, `wheat` carbs, `droplet` fat; `coffee` / `salad` / `utensils` /
`apple` for breakfast / lunch / dinner / snack (the `SLOTS` list in `useEating`);
`scan-barcode`, `mic`, `search`, `book-open` (recipes). Tabs: `notebook-pen` Today,
`chef-hat` Library, `chart-no-axes-column` Progress, `settings` Settings.

## Touch, safe areas, scrolling

- **44 px minimum** for anything tapped on its own: `md` buttons and inputs are 44,
  `lg` 48, `xl` 56; tab bar items are 64 tall. `xs`/`sm` buttons (24/32) live only inside
  rows that are themselves the target, or get `.app-hit` (an invisible 44 px hit area).
- **No hover-only anything**; hover styles are a bonus for mouse users. Pressed states
  (`active:`) give the feedback a finger needs.
- **Safe areas**: the page runs under the notch and the home indicator
  (`viewport-fit=cover`); anything pinned to an edge pads itself with
  `.app-safe-top` / `.app-safe-bottom` or `env(safe-area-inset-*)`.
- **Scrolling** is the window's own (momentum, Safari's collapsing bars). The app bar is
  sticky, the tab bar fixed; `scroll-padding` keeps a focused field clear of both.
  Horizontal strips use `.app-scroll-x` (snap, no scrollbar, edge fade).
- `--app-tabbar-space` is how much room the tab bar takes at the bottom — use it for
  anything that must clear it (a sticky action bar, a toast offset).
- **Layers**: app bar `z-30`, tab bar `z-40`, everything that floats — sheets, modals,
  slideovers, menus, popovers, tooltips — `z-50` (set once in `app.config.ts`), the
  confirm dialog `z-[60]`, toasts `z-[100]`. Don't invent other z-indexes.

## The shell

```
┌──────────────────────────────┐  ShellAppBar — sticky, transparent until the
│ SATURDAY 3 OCTOBER        ⋯  │  page scrolls, then glass + hairline.
│ Today                        │  eyebrow (date) · display title · actions
│ [toolbar: week strip / tabs] │  #toolbar stays pinned with it
├──────────────────────────────┤
│  cards …                     │  AppPage body: px-4, gap-3, .app-page-in
│                              │
│ ╭──────────────────────────╮ │  ShellBottomTabBar — floating glass bar,
│ │ Today Library (+) Prog Set│ │  raised "+" → useQuickAdd().open()
│ ╰──────────────────────────╯ │
└──────────────────────────────┘
```

- `layouts/default.vue` — canvas, a soft light wash at the top, the 34rem column padded
  for the tab bar, then `ShellBottomTabBar`, `QuickAddSheet`, `ConfirmDialog` (each
  mounted once).
- `ShellBottomTabBar` — Today · Library · [+] · Progress · Settings. The active tab gets
  a pill behind its icon and a bolder label; the "+" is a 56 px brand circle raised out
  of the bar. While a text field has focus on a touch screen the bar slides away, so it
  never sits on top of the keyboard.
- `layouts/auth.vue` — `/login`, `/register`, `/onboarding`, `/auth/callback`: logo and
  theme toggle on top, the hero illustration (`ShellHeroArt`) in a warm wash, and the form
  on a sheet that rises over it. Onboarding gets the compact version (no illustration).

## Building blocks (`components/shell/`)

Each file documents its props at the top. Auto-imported with the `Shell` prefix.

| Component | What it is | Main props / slots |
| --- | --- | --- |
| `ShellAppBar` | the top app bar | `title`, `eyebrow?` (defaults to today's date; `false` hides it), `back?`; `#heading`, `#actions`, `#toolbar` |
| `ShellBottomTabBar` | the tab bar with the "+" | — |
| `ShellCard` | the card every screen is built of; flush rows or padded body, optional header | `title?`, `icon?`, `count?`, `hint?`, `flush?`, `tone?: 'default' \| 'brand' \| 'muted'`, `to?`, `loading?`, `isEmpty?`, `empty?`; `#actions`, `#header`, `#footer` |
| `ShellSection` | a titled group of cards | `title?`, `description?`; `#actions` |
| `ShellListRow` | a tappable row: icon, title, subtitle, trailing value, chevron | `title`, `subtitle?`, `icon?`, `tone?`, `to?`, `chevron?`; `#leading`, `#subtitle`, `#trailing` |
| `ShellMacroRing` | concentric progress rings (kcal outside, macros in) | `tracks: { key, value, goal }[]` (type `RingTrack`), `size?` (208), `thickness?` (10 for several rings, 16 for one), `label?`; default slot = the centre — `text-[2rem]` inside four rings, `text-hero` inside one |
| `ShellMacroBar` | one macro (or kcal) against its target: label, `used/goal`, bar | `macro`, `value`, `goal`, `label?`, `unit?`, `compact?` |
| `ShellMacroLine` | "P 24 · C 30 · F 8 · 320 kcal" in the macro inks | `macros`, `kcal?: boolean`, `size?` |
| `ShellStatTile` | one number with its label and context | `label`, `value`, `unit?`, `hint?`, `macro?`, `icon?`, `tone?` |
| `ShellSegmented` | segmented control with a sliding thumb | `v-model`, `options: { value, label, icon? }[]`, `size?` |
| `ShellEmpty` | an empty state that invites the next step | `icon?`, `title`, `description?`, `compact?`; default slot = actions |
| `ShellSkeleton` | shimmering placeholders shaped like the content | `variant: 'rows' \| 'card' \| 'ring' \| 'tiles' \| 'text'`, `count?` |
| `ShellLogoMark` / `ShellLogo` | the mark (two-tone, follows the theme) / mark + wordmark | `ShellLogo`: `size?`, `to?` |
| `ShellHeroArt` | the auth illustration (a bowl of good things) | — |

## The mark and the icons

The mark is the day's ring — three quarters closed — with a leaf growing where the day
starts: the same ring Today fills, and, read small, a fruit with a leaf. Basil on light,
light basil on dark, cream on the basil tile.

`scripts/make-icons.py` holds the geometry and writes `public/logo.svg`,
`public/favicon.svg` and `public/icons/` (`icon-192.png`, `icon-512.png` rounded tiles;
`maskable-512.png` full bleed with the mark inside the 80 % safe circle;
`apple-touch-icon.png` 180 × 180, opaque). Re-run it after changing the mark:

```bash
../nutrijurnal-back/.venv/bin/python scripts/make-icons.py
```

`components/shell/LogoMark.vue` carries the same paths for use inside the app.

PWA colours for the manifest and `<meta name="theme-color">`: `theme_color` /
`background_color` `#f8f5f1` (light canvas); dark `#0f0e0c`.

## Rules of thumb

- One accent per screen region; colour must answer a question.
- Numbers: `tabular-nums`, thin-space thousands (`formatKcal`), the unit smaller and
  muted after the number.
- Every number has context — "of 2 300", "left", "a day on average".
- Empty is an invitation: say what to do next and offer the button that does it.
- Cards, not boxes in boxes: one level of card per region; inside a card use hairlines
  and `bg-elevated` wells.
- No `sm:`/`md:` breakpoints inside the column; no hover-only actions.
