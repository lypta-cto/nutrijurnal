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
(main.css) pad anything pinned to an edge. `components/AppPage.vue` is a screen: a sticky
header (title or a custom `#heading`, `#actions`, an optional pinned `#toolbar` row) and
the body under it.

### Quick add — the "+" contract

- `useQuickAdd()` exposes `open(kind?)`, `close()`, plus `isOpen`, `kind` and `savedAt`.
  `kind` is `'search' | 'scan' | 'voice' | 'quick' | 'recipe'`.
- `<QuickAddSheet />` is mounted once in `layouts/default.vue`. `open()` shows the sheet
  with every way in; `open(kind)` goes straight to one. Voice records inside the sheet;
  the others open `MealForm` on the matching tab (`quick` → the Kcal tab).
- After a save it calls `markSaved()`; Today watches `savedAt` and reloads the day.

## The diary in the frontend

`composables/useEating.ts` holds every type, formatter and API call. The day, its meals
and the week live in `useState`, so Today, the quick-add sheet and the forms agree without
passing state down.

| Piece | Job |
| --- | --- |
| `pages/index.vue` | Today: day picker, week strip, scoreboard, meals that open onto editable items, targets and export dialogs |
| `components/MealForm.vue` | The one place a meal is written: tabs Search · Type · Recipe · Scan · Kcal feeding one editable list |
| `components/EatingScoreboard.vue` | kcal against target, a bar per macro |
| `components/VoiceMeal.vue` / `MealVoice.vue` | record a meal / play back a meal's recording |
| `pages/library.vue` + `RecipeModal.vue` + `FoodForm.vue` | own recipes (create by name or pasted dish, edit, cook onto a day, delete); foods (own ones edited or removed, shared ones copied into your own version) |
| `pages/progress.vue` | 7 / 30 days against the kcal target, averages |
| `pages/onboarding.vue` + `TargetsFields.vue` | daily targets; the same fields serve Settings and Today |

## API surface used

All under `/api/v1` (full list in `../nutrijurnal-back/README.md`):
`/auth/*` (register, login, refresh, logout, me, providers, password, avatar,
`DELETE /auth/me`), `/eating/settings`, `/eating/foods` (+ `/scan`), `/eating/parse`,
`/eating/days`, `/eating/meals` (+ `/from-recipe`, `/items`, `/voice`),
`/eating/recipes`, `/eating/export`.

## Not built yet

PWA manifest and service worker (icon paths are reserved under `public/icons/`), label
OCR for a barcode miss, charts on Progress, password reset and email verification, rate
limiting on sign-up and login. Production hosting is a later step.
