# Changelog

Newest first. One line per piece of work that landed, in either repo.

## 2026-10-03

- **Every screen restyled for the phone.** Today (week rings, the day's four rings with
  eaten and target, meal rows whose names wrap, two-line items), the quick-add sheet and
  every form sheet (grouped lists, chips, one full-width action), Library, Progress (stat
  tiles, clay columns past the target, a day-by-day twin that fits 375 px), Settings
  (sections of list rows), sign-in, onboarding and the goal calculator, empty, loading
  and error states, toasts — all on the shell blocks, light and dark. Motion on the
  design's durations and `--ease-soft`, standing still under reduced motion.
  `SheetCard`, `SettingsRow` and the template logo are gone; `docs/design.md` gained
  Patterns and Screens.
- **Account data.** Settings → Your data: the diary as PDF/CSV for a period and every bit
  of the account as one JSON file (`GET /auth/me/export`, recordings on a switch).
  Closing the account takes every feature table with it.
- **Demo.** "Try the demo" on sign-in: a throwaway account with fourteen days of generic
  meals, water and weight; deleted after `DEMO_TTL_DAYS` unless kept with an email and
  password (`/auth/demo`, `/auth/demo/claim`), limited per address.
- **Motion.** Rings and bars that fill, numbers that count up, swipe-left delete and
  swipe-right duplicate on meal rows, sideways swipes between days, list and tab
  transitions, haptics, every form a bottom sheet; all still under reduced motion.
- **PWA.** `@vite-pwa/nuxt`: manifest with the design's colours and icons, an offline
  shell, foods/recipes/days readable offline (cleared on sign-out), install prompt on
  Android and the Add to Home Screen steps on iOS.
- **Undo and reminders.** Deletes no longer ask — the toast has Undo (a deleted meal comes
  back whole). Meal, water and daily-summary reminders by Web Push: subscriptions,
  VAPID (`python -m app.cli vapid`), pywebpush, an in-process loop sending in each
  person's own timezone, honest fallbacks when push is unsupported or blocked.
- **Progress.** One `/eating/progress` request; streak, averages, kcal vs target,
  macro split, weight trend and water as hand-rolled SVG charts with a table twin.
- **Water and weight.** Glasses on Today with one-tap +glass and undo, a goal and glass
  size in Settings; one weighing a day with the week's change.
- **Voice.** "dodaj 200 g piletine i 100 g pirinča za ručak" / "200g chicken and rice
  for lunch" → a draft with the slot detected, confirmed before saving; Srpski/English
  dictation, recording kept either way. English amounts and aliases in the parser.
- **Live barcode scanning.** Native `BarcodeDetector` or `zxing-wasm`, torch, vibrate,
  check digit, `GET /eating/foods/barcode/{digits}`; typed digits and the photo upload
  as fallbacks.
- **Quick add.** Breakfast / Lunch / Dinner / Snacks slots, starred and recent foods
  with their last amounts, quick kcal, copy a meal or a day, repeat yesterday's slot.
- **Goals.** Onboarding is a goal calculator (Mifflin–St Jeor, activity, goal and pace,
  protein g/kg, fat %), every number overridable, also in Settings.
- **Design system and shell.** `docs/design.md` sets the direction (a kitchen notebook in
  morning light) and the tokens: basil brand on a cream canvas, oat greys, one colour per
  diary question (kcal basil, protein sky, carbs violet, fat amber, over-target clay,
  water teal), Plus Jakarta Sans with Fraunces titles, 44 px controls. New mark and PWA
  icons (`scripts/make-icons.py`). Floating glass tab bar with a raised "+", a scroll-aware
  app bar, an auth layout with an illustrated hero, and the `Shell*` building blocks the
  pages are restyled with next.
- **Foundation.** Nutrijurnal split out of the CTO app's eating module into two repos.
  Backend from `admin-dashboard-template-back`: open self-registration, Google sign-in off
  unless configured, account deletion, targets and `onboarded_at` on the user, the eating
  API without the CTO's enabled gate, cookbook, trainer plan or label OCR. Shared foods
  are seeded on boot (idempotent by key) and read-only; foods a person adds or scans are
  private. Quick-kcal items (numbers without a food). One clean initial migration.
- Frontend from `admin-dashboard-template-front`, rebuilt as a phone app: centred column,
  bottom tab bar (Today · Library · + · Progress · Settings), quick-add sheet behind the
  "+", the diary UI ported to phone-width grids, a Search tab and a Kcal tab in the meal
  form, Library for own recipes and foods, onboarding for daily targets, a first Progress
  page, Settings with profile, targets, theme, password, sign out and account deletion.
