# Architecture

Nutrijurnal is two repos, the same split as Luka's other apps:

| Repo | What | Local port |
| --- | --- | --- |
| `nutrijurnal` (this one) | Nuxt 4 SPA — `ssr: false`, Nuxt UI v4, Tailwind v4, strict TypeScript | 3400 |
| `nutrijurnal-back` | FastAPI + SQLAlchemy 2 (async) + Alembic + Postgres | 8004 (Postgres 5437) |

It grew out of the eating module of the CTO Productivity App, extracted into an app of its
own: public sign-up, one diary per person, phone first. It starts from the
`admin-dashboard-template` pair (auth, refresh tokens, Google OAuth, Argon2).

## The rules everything else follows

- **Multi-tenant.** Every query on user data filters on the signed-in person. Shared foods
  (seeded from `foods_seed.json`, `user_id IS NULL`) are global and read-only; a food a
  person adds or scans is visible to them alone; recipes, meals, voice notes and targets
  are private. A request for someone else's row is a plain 404.
- **History holds still.** A meal item carries a copy of its food's per-100 g numbers, so
  correcting a food never rewrites a past day.
- **English UI, Serbian data.** Every string the app says is English; food names are data
  and stay as the pantry spells them. The free-text parser and dictation are Serbian-aware
  (five-letter stems, "pola", "merica"), and English food names match too through each
  shared food's `name_en`.
- **No third-party recipes.** Nothing from a cookbook or a personal meal plan is shipped;
  people build their own recipes.

## Auth

Access token (15 min) in memory only (`useAuthState`), refresh token in an `httpOnly`
cookie scoped to `/api/v1/auth` and rotated on every use. `useApi` sends the bearer token,
refreshes once on a 401 and replays. `middleware/auth.global.ts` restores the session on
first navigation, keeps `/login` and `/register` public, finishes the Google round trip on
`/auth/callback`, and sends any account without `onboarded_at` to `/onboarding` first.

Registration is open (`POST /auth/register` with email, password, name) and returns the
same session as a login. Google sign-in appears only when `GET /auth/providers` says the
API has a client id.

## The shell

`layouts/default.vue` is one column, at most 34rem wide and centred on a desktop — a phone
app first, never a dashboard. Under it sits the fixed bottom tab bar:

```
Today · Library · [+] · Progress · Settings
  /      /library  sheet  /progress  /settings
```

Safe areas: `viewport-fit=cover` in `app.vue`, and `.app-safe-top` / `.app-safe-bottom`
(main.css) pad anything pinned to an edge. `components/AppPage.vue` is a screen:
`ShellAppBar` (eyebrow and display title or a custom `#heading`, `#actions`, an optional
pinned `#toolbar` row — transparent at rest, glass once the page scrolls) and the body
under it. How every screen is laid out is in `docs/design.md` → Screens.

### Quick add — the "+" contract

- `useQuickAdd()` exposes `open(kind?, { slot? })`, `close()`, plus `isOpen`, `kind`,
  `slot` and `savedAt`. `kind` is `'search' | 'scan' | 'voice' | 'quick' | 'recipe'`;
  `slot` is the meal it goes into (the clock decides when nobody says).
- `<QuickAddSheet />` is mounted once in `layouts/default.vue`. `open()` shows the sheet:
  slot chips, a search box, the ways in (Scan · Voice · Kcal · Recipe · Copy · Type),
  "Repeat yesterday's …" for the slot, then the person's **starred** and **recent** foods
  with the amount they last ate (one "+" writes it again). Search, the amount panel
  (`FoodAmountPanel`), quick kcal (`QuickKcalPanel`), copy another day
  (`CopyMealsPanel`), the live barcode scanner and voice all happen **in the sheet**;
  `recipe` and Type open `MealForm` on that tab. Foods added in one sitting join one
  meal. Every add has an Undo in its toast.
- After a save it calls `markSaved()`; Today watches `savedAt` and reloads the day.
- Deep links: `/?add=<slot>` (meal reminders) and `/?add=now` (the PWA shortcut) open
  the sheet on that slot.

## The diary in the frontend

`composables/useEating.ts` holds every diary type, formatter and API call. The day, its
meals and the week live in `useState`, so Today, the quick-add sheet and the forms agree
without passing state down. `useBody.ts` is water, weight and progress;
`useReminders.ts` / `usePush.ts` the reminders.

Meals sit in **slots** — breakfast, lunch, dinner, snack — sent by the page or worked out
by the API from the time or the name; the title stays the person's (an untitled meal is
named after its one food, or its slot).

| Piece | Job |
| --- | --- |
| `pages/index.vue` | Today: the day's name in the app bar (tap to pick a date), a week strip of seven small rings, `DemoBanner`, `EatingScoreboard`, one card per slot (subtotal, "+", "Repeat" when empty), meal rows (`SwipeRow`: left deletes, right duplicates) opening onto editable two-line items, `WaterCard`, `WeightCard`, `InstallPrompt`; targets / move / export sheets. A sideways swipe changes the day |
| `components/MealForm.vue` | The full form (in `FormSheet`): slot, time, optional name, tabs Search · Type · Recipe · Scan · Kcal feeding one editable list. Editing a meal opens here |
| `components/EatingScoreboard.vue` | the day's card: four `ShellMacroRing` tracks with the kcal left counting up (`CountUp`), eaten and target either side, three `ShellMacroBar`s; "Set your targets" without them |
| `components/BarcodeScanner.vue` + `useBarcodeScanner.ts` | live camera scanning: native `BarcodeDetector`, else `zxing-wasm` (self-hosted `.wasm`); check digit, torch, vibrate, typed digits and photo upload as fallbacks; every refusal explained |
| `components/VoiceMeal.vue` / `MealVoice.vue` | dictate (Srpski / English) → parsed draft with slot → confirm; records audio either way / play back a meal's recording |
| `components/GoalWizard.vue` | the goal calculator (onboarding and Settings): body → activity → goal + pace → plan with protein g/kg and fat % sliders and exact overrides |
| `components/WaterCard.vue` / `WeightCard.vue` | glasses that are buttons, +glass, other amounts / the day's weight, the week's change |
| `pages/library.vue` + `RecipeModal.vue` + `FoodForm.vue` + `FoodRow.vue` | own recipes; foods with stars (own ones edited or removed with Undo, shared ones copied into your own version) |
| `pages/progress.vue` + `components/chart/*` | 7 / 30 / 90 days: stat tiles (average day, streak, days logged, weight change); kcal columns with the target line (clay past it), macro split, weight line, water columns; a day-by-day twin of every chart, each day a bar against the target |
| `pages/settings.vue` | profile (avatar, name), then titled sections of shell cards: targets (+ calculator sheet), water goal, `ReminderSettings`, `InstallPrompt`, appearance, Your data (diary PDF/CSV via `ExportSheet`, everything as JSON), account (password on demand, sign out, delete) |
| `pages/login.vue` | sign in, and "Try the demo" |

### Goals

`POST /eating/goals/estimate` does the arithmetic (Mifflin–St Jeor × activity, ± ~7 700
kcal per kg, a sex-specific floor, protein by bodyweight capped at 40 % of the energy,
fat as a share, carbs the rest); the wizard shows it and every number can be overwritten.
The answers are saved as `profile` on `/eating/settings`; the weight given is logged as
that day's weighing.

### Water, weight, progress

Water is one row per glass (Undo = delete the last), weight one row per day. Today's
`GET /eating/days/{day}` carries both. Progress is one request, `GET /eating/progress`,
so every chart reads the same slice; averages count only days with meals. Charts are
hand-rolled SVG in real pixels: one series per chart, the target as a dashed reference
on the same axis, per-slot hit targets and a keyboard-readable crosshair, colours from
the design tokens (`MACRO_BARS.fill`, `CHART_COLORS`).

### Undo

Destructive actions do not ask first; the toast carries Undo. A deleted meal is kept
whole server-side for a day (`deleted_meals`) and `POST /eating/meals/{id}/restore`
brings back the very same meal; a removed item is re-added at its `position`; a removed
food is un-archived; a removed reminder or weight is recreated.

### Reminders (Web Push)

Settings → Reminders lists meal, water and daily-summary reminders (time, weekdays,
on/off). `usePush()` subscribes this browser with the server's VAPID key
(`GET /push/config`) and sends the subscription and the browser's timezone. The API's
in-process loop sends what is due in the person's own clock (claimed atomically, once a
day) and stays quiet when the slot is already logged or the water goal is met.
`public/push-sw.js` (imported by the generated worker) shows the notification and opens
`url` on tap. Every state that stops a notification has its own sentence: no push in
this browser, iPhone outside the installed app, blocked, server without keys.

### PWA

`@vite-pwa/nuxt` in `nuxt.config.ts`: the manifest (name, standalone, design colours,
contract icons, an "Add food" shortcut) and a generated worker that precaches the shell,
answers navigations with it, keeps foods / recipes / days readable offline
(`nutrijurnal-api`, cleared on sign-out and account deletion) and caches the barcode
WASM on first use. `<NuxtPwaManifest />` in `app.vue`; `theme-color` follows the theme.
`InstallPrompt` uses the held-back `beforeinstallprompt` on Android/desktop Chromium and
shows Share → Add to Home Screen on iOS. The dev worker is off (`pwa.devOptions`).

### Motion and feel

`assets/css/motion.css` (after the design's `main.css`): list transitions
(`<TransitionGroup name="list">`), the tab cross-fade (`app.pageTransition`), the day
slide, and panels swapped inside a sheet (`<Transition name="panel" mode="out-in">`).
Rings, bars and chart marks animate in; numbers count up; rows swipe; `useHaptics()`
buzzes on adds, glasses, swipes. Every duration and curve is the design's (120 ms press,
200 ms state change or exit, 300 ms arrival, 700 ms filling, `--ease-soft`). Every form
is a bottom sheet (`FormSheet` or a `UDrawer` with `SHEET_UI`). Everything checks
`prefers-reduced-motion` (CSS, and `useReducedMotion()` in script); sheets then appear
instead of sliding.

### Demo

"Try the demo" (`POST /auth/demo`) makes a signed-in throwaway account with fourteen days
of generic plates, water, weight, two recipes and stars, ending on the viewer's today.
`DemoBanner` says when it is deleted and offers "Keep it" (`POST /auth/demo/claim`).

## API surface used

All under `/api/v1` (full list in `../nutrijurnal-back/README.md`): `/auth/*` (register,
login, refresh, logout, me, providers, password, avatar, `DELETE /auth/me`,
`/me/export`, `/demo`, `/demo/claim`), `/eating/settings`, `/eating/goals/estimate`,
`/eating/foods` (+ `/quick`, `/{id}/favourite`, `/barcode/{digits}`, `/scan`),
`/eating/parse`, `/eating/days` (+ `/{day}/copy`), `/eating/meals` (+ `/from-recipe`,
`/{id}/copy`, `/{id}/restore`, `/items`, `/voice`), `/eating/recipes`,
`/eating/water`, `/eating/weight`, `/eating/progress`, `/eating/export`,
`/push/*`, `/reminders`.

## Not built yet

Label OCR for a barcode miss, password reset and email verification, rate limiting on
sign-in and registration (the demo has its own per-address limit), offline writes
(the offline cache is read-only). Production hosting, VAPID keys and secrets are a
later step.
