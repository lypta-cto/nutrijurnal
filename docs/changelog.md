# Changelog

Newest first. One line per piece of work that landed, in either repo.

## 2026-10-03

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
