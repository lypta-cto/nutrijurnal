# Nutrijurnal

A public, mobile-first food diary. Sign up, then write down what you ate — find it in the
pantry, type it in plain words ("50g oats, 1 scoop whey, 1 banana"), scan the barcode,
say it out loud, cook it from your own recipe, or just enter the kcal — and watch the day
add up against your targets.

This repo is the frontend: a Nuxt 4 single-page app (`ssr: false`) with Nuxt UI v4,
Tailwind v4 and strict TypeScript. The API is the sibling repo
[`nutrijurnal-back`](../nutrijurnal-back) (FastAPI, port 8004).

## Run it locally

The API first — see `../nutrijurnal-back/README.md`; in short:

```bash
cd ../nutrijurnal-back
docker compose up -d db                      # Postgres on :5437
.venv/bin/alembic upgrade head
.venv/bin/python -m app.cli dev              # http://localhost:8004
```

Then this app:

```bash
npm install
cp .env.example .env                         # NUXT_PUBLIC_API_BASE=http://localhost:8004/api/v1
npm run dev                                  # http://localhost:3400
```

Open http://localhost:3400, create an account, answer the targets question, and the diary
is yours. Claude Code's `.claude/launch.json` has both halves: `nutri-api` and `nutri-dev`.

Ports are offset from Luka's other local stacks (frontend **3400**, API **8004**,
Postgres **5437**) so everything runs side by side.

## Scripts

```bash
npm run dev        # dev server on :3400
npm run lint       # eslint
npm run typecheck  # vue-tsc via nuxt typecheck
npm run build      # production build (static SPA)
```

## What's where

- `app/pages/` — `index.vue` (Today), `library.vue` (recipes + foods), `progress.vue`,
  `settings.vue`, `onboarding.vue`, `login.vue`, `register.vue`, `auth/callback.vue`
- `app/layouts/default.vue` — the phone shell: one centred column, the bottom tab bar
  (`components/shell/BottomTabBar.vue`) and the quick-add sheet
- `app/components/QuickAddSheet.vue` + `app/composables/useQuickAdd.ts` — the "+"
- `app/composables/useEating.ts` — every diary type, helper and API call
- `docs/` — architecture and changelog; read `docs/architecture.md` first
