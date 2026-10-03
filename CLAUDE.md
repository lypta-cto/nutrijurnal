# CLAUDE.md — nutrijurnal (frontend)

**Nutrijurnal** is a public, mobile-first food diary anyone can sign up for. This is the
Nuxt frontend; the API is the sibling repo `../nutrijurnal-back` (FastAPI, port 8004) and
must be running for anything past the login screen.

Grown out of the CTO Productivity App's eating module (`../cto-productivity-app`), on the
`admin-dashboard-template-front` shell. `docs/` here is the product brain for BOTH repos —
read `docs/architecture.md` before larger changes, and add a line to `docs/changelog.md`
when work lands.

## Stack

Nuxt 4 (`ssr: false`, static SPA) · Nuxt UI v4 · Tailwind CSS v4 · TypeScript strict.
Node 24, npm.

## Ports

Frontend **3400** · API **8004** · Postgres **5437** (db `nutrijurnal`) — offset from the
other local stacks. `.claude/launch.json`: `nutri-api` (backend dev server) and
`nutri-dev` (`npx nuxt dev --port 3400`).

## Commands

```bash
npm install
npm run dev                          # :3400 (backend first — see ../nutrijurnal-back/CLAUDE.md)
npx nuxt typecheck && npx eslint .   # the checks — green before any commit
```

`.env` (never read or copy it): `NUXT_PUBLIC_API_BASE=http://localhost:8004/api/v1`,
see `.env.example`. Only the lead runs `npm run build` / `nuxt build` / `nuxt generate`.

## Layout

- `app/layouts/default.vue` — the phone shell: one column (max 34rem, centred on desktop),
  `components/shell/BottomTabBar.vue` (Today · Library · [+] · Progress · Settings),
  `<QuickAddSheet />` and `<ConfirmDialog />`, each mounted exactly once.
- `app/layouts/auth.vue` — login, register, onboarding, Google callback.
- `app/pages/` — `/` Today, `/library`, `/progress`, `/settings`, `/onboarding`, `/login`,
  `/register`, `/auth/callback`.
- `app/components/AppPage.vue` — a screen: sticky header (`#heading`, `#actions`,
  `#toolbar`) + body. Use it for every signed-in page.
- `app/composables/useEating.ts` — the diary's types, formatters and API calls; state in
  `useState` so pages, sheet and forms agree. `useQuickAdd.ts` — the "+" contract:
  `open(kind?: 'search' | 'scan' | 'voice' | 'quick' | 'recipe', { slot? })`, `close()`,
  `savedAt`. `useBody.ts` (water, weight, progress), `useReminders.ts` + `usePush.ts`
  (reminders), `useBarcodeScanner.ts`, `useHaptics.ts`, `useReducedMotion.ts`.
- `app/components/QuickAddSheet.vue` — fast logging in the sheet itself (search, starred
  and recent foods, amount panel, quick kcal, copy, scanner, voice). `MealForm.vue` is the
  full form (and the editor): open it on a tab rather than building another.
- Forms are bottom sheets: `FormSheet.vue`, or a `UDrawer` with `:ui="SHEET_UI"`
  (`app/utils/sheet.ts`). Destructive actions don't confirm — the toast carries Undo.
- Charts are hand-rolled SVG in `app/components/chart/` (`ChartColumns`, `ChartLine`,
  `ChartSplit`); colours from tokens (`MACRO_BARS.fill`, `CHART_COLORS`).
- PWA: `pwa` in `nuxt.config.ts` (@vite-pwa/nuxt), `public/push-sw.js` for notifications.
- `app/middleware/auth.global.ts` — session restore, public routes, Google callback,
  and the redirect to `/onboarding` until `user.onboarded_at` is set.

## Ownership (parallel agents)

- Design: `app/assets/css/main.css`, `app/app.config.ts`, `app/layouts/**`,
  `app/components/shell/**`, `public/icons/**`, `public/favicon.svg`, `public/logo.svg`.
- Features: `nuxt.config.ts`, `package.json` + lockfile, `app/plugins/**`, PWA manifest +
  service worker (`public/push-sw.js`), `app/assets/css/motion.css`, backend feature
  modules and migrations.
- Tester: backend `tests/**`, frontend test files and vitest config.
- PWA icon paths (design makes them, the manifest references them):
  `public/icons/icon-192.png`, `icon-512.png`, `maskable-512.png`,
  `apple-touch-icon.png` (180×180), `public/favicon.svg`, `public/logo.svg`.

## Hard rules

- Every user-visible string — labels, toasts, empty states, aria-labels — is English.
  Food names are data and stay Serbian.
- The app is public and multi-tenant: never show or send another person's data; shared
  foods are read-only (offer "your own version" instead of editing them).
- Phone first: no viewport breakpoints (`sm:`/`md:`) inside the column — it is the same
  width on a desktop. No hover-only actions; touch has no hover.
- No cookbook or meal-plan content, ever — people build their own recipes.
- Never read, print or copy any `.env`. Never configure production hosting or secrets.
- Never sign in through a browser or mint sessions to drive the UI; verify with
  typecheck, lint and (once set up) vitest.
- Never `git push`. Commit only your own paths (`git add <paths>`), imperative subject,
  a body that says why, ending with the `Co-Authored-By` line.
- Comments say why, not what. No dead code, no TODO litter.
