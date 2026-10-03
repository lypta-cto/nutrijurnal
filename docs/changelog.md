# Changelog

Newest first. One line per piece of work that landed, in either repo.

## 2026-10-03

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
