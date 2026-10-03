# Changelog

Newest first. One line per piece of work that landed, in either repo.

## 2026-10-03

- **Design round 2 — the polish pass.** The last controls in their web defaults are
  iOS's now: menus are context menus (body-size rows, hairlines, the glyph after the
  words, a shaded band between groups — new `--app-menu-gap`), checkboxes the selection
  circle, sliders a thin track with the switch's white thumb, toasts banners with an
  accent Undo and a 2 px timer. The food, recipe and meal forms and the calculator's
  body numbers are grouped field rows (ShellFieldRow gains `hint`), day and time pill
  rows like Calendar's, the notes groups headed "Note". A short sheet's header and
  footer no longer show a grey glass band at rest. Starred foods are filled stars; a
  meal's "more" is the horizontal ellipsis; ring and bar tracks are 25 % in dark mode;
  the install card shows the real app icon; Reminders lose the box-in-a-box and the
  full empty state; the camera badge is the accent. Things that were cut off now fit: Progress's dates ("Wed 30 S…"), the
  macro legend, the add-an-item and barcode hints, Import's explanation; a week's charts
  label every day. Only the look changed — same handlers, models and limits; checked in
  the signed-in demo at 375 px light and dark, then 768 px and 1280 px.
- **Import, calendar exports, the new mark.** Settings → Import a diary takes a Nutrijurnal
  backup (.json) or a diary CSV — this app's or the CTO app's, same columns — and adds
  nothing twice. The export's presets are now Today, This week, Last week (Monday to
  Sunday) and This month, counted from today, plus Pick the dates. CSV downloads work: every
  file download asks for a blob (ofetch read text/csv as a string). The mark is Luka's logo,
  an apple whose corner folds like a page, traced into a vector; `scripts/make-icons.py`
  writes the icons from `scripts/logo-source.png`.
- **Redesign, part 3 — a visual pass.** The four rings on Today are 180 px with 8 px
  strokes 2 px apart, so a four-digit "kcal left" no longer runs into the fat ring; a
  meal's mic and chevron stay on its name's last line instead of wrapping alone; the
  water glasses are plain glyphs with 44 px targets rather than a second row of grey
  tiles; a reminder's glyph is grey and its weekdays are quiet chips (new
  `.app-chip-quiet`), so the switch is the row's only accent; Chrome's clock glyph sits
  close, so a reminder's time no longer clips; sign-in and sign-up lose the red
  required asterisks; a few empty states and hints say it plainly ("No recipes yet",
  "No recent foods yet", "every day"). Checked on the sign-in screens at 375, 768 and
  1280 px in both themes and on template-faithful sketches of Today and Settings — the
  signed-in screens themselves were not opened (no session).
- **Redesign, part 2 — every screen.** Today, the "+" sheet and its panels, every form
  sheet, Library, Progress, Settings, sign-in and onboarding are restyled onto the new
  system: grouped lists with small-caps headers instead of bordered boxes and stacked
  cards, regular-weight row titles, counts as plain words, no tinted tiles, washes,
  sparkles, wands, gradient buttons, glows or badges. Settings is iOS Settings (the
  profile first, values edited inline with the new `ShellFieldRow`, Save only once
  something changed); the five ways into a meal and the slot are segmented controls;
  the export period, activity and goal are checkmark lists; the ways into the "+"
  sheet are a row of equal accent buttons; the mic is one flat circle and recording a
  red dot and a running time; swipe actions are solid. Numbers that matter are SF
  Rounded. Charts: hairline gridlines, a glass callout, and water columns on a lighter
  `--app-water` fill. Alerts are grey notes with only the glyph in colour; field text
  keeps its phone size at every width; groups on the plain sign-in screens step to grey
  (`.app-on-plain`). The "+" sheet's container now scrolls (glass header), so dragging
  down from the header while its list is scrolled scrolls rather than closes.
- **Redesign, part 1 — the system and the shell.** `docs/design.md` is now "a quiet iOS
  app": the system font (SF on Apple devices, never embedded), iOS text styles with
  Apple's tracking, Apple's grey layers (`#f2f2f7` canvas, white cells; black and
  `#1c1c1e` in dark) and one accent (basil, deepened to `#1d7f43` for AA), quieter macro
  colours, small radii, hairline separators, almost no shadows, a glass material with an
  opaque fallback (no `backdrop-filter`, `prefers-reduced-transparency`) and a spring
  curve. Nuxt UI themed to match: grey-filled fields, rounded-rect buttons, iOS switch,
  sheets with a grabber whose header and footer turn to glass as the body scrolls, glass
  menus and toasts. Shell: a large title that collapses into a compact glass bar with the
  toolbar pinned under it, a floating glass tab bar with a flat "+", a plain auth layout
  (the hero illustration is gone), a plain error page. Blocks: new `ShellList` (inset
  grouped list), and `ShellCard`, `ShellSection`, `ShellListRow`, `ShellEmpty`,
  `ShellStatTile`, `ShellSegmented`, `ShellSkeleton`, the macro line and bar flattened —
  no tinted tiles, pills or washes. The mark is one flat colour; icons regenerated. The
  screens themselves are restyled in the next pass.
- **Ready to deploy.** `vercel.json` rewrites `/api/*` and `/uploads/*` to the Render
  service, so the refresh cookie stays first-party; a production build talks to `/api/v1`
  on its own origin with no environment variable to set; the service worker no longer
  answers navigations to `/api` or `/uploads` with the app shell. Backend: `render.yaml`,
  Supabase connection strings work as pasted, row-level security closes Supabase's
  public Data API, and the rate limiter reads the visitor behind both proxies.
- **QA round 2 — the tester's second list, fixed.** Parser: decilitres and dekagrams,
  litres and kilos in every case ending ("2 litra", "pola kile"), an amount written after
  the food ("piletina 200 g"), "half a litre", hundreds said in words ("dvesta grama",
  "pet sto"), "četvrt", "jedna i po banana", "1.000 g" as a thousand, "3,5% mleko" keeping
  its percentage in the name, a portion of rice as 100 g rather than a handful, "kafa sa
  mlekom" as coffee. API: a day more than one ahead of UTC's today is refused for every
  write (meals, moves, copies, recipes, water, weight); a food's portion weighs at most
  5000 g and an Open Food Facts label no food can hold is a miss; sign-in (per address,
  and wrong passwords per email), sign-up and demos are throttled with a 429 and
  `Retry-After` (`TRUSTED_PROXY` decides whether `X-Forwarded-For` counts). Frontend:
  the meal form, the Move sheet and a recipe's day refuse a day that hasn't come (iOS's
  wheel ignores `max`); only the newest food or recipe search lands, and a failed one
  says so; water, weight, the copy panel and the quick foods say when they didn't load;
  the Move sheet never says "Invalid Date"; sign-in and sign-up tell password managers
  their fields; exports go through the share sheet on iPhone and iPad; a typed decimal
  comma stays a comma; a recorder that won't start turns the microphone off; a desktop
  click on the day's name opens the calendar; Back closes the open sheet
  (`useSheetHistory`). `SheetCard.vue` is finally gone.
- **QA round 1 — the bugs the tester found, fixed.** Parser: the decimal comma ("0,5 l",
  "31,25 g") stays in its amount, kilos and litres are saved at their weight, a pinch is a
  pinch and "1 jogurt" a glass. A stated dish is counted per serving, so editing the
  servings adds up; a PATCH with `day: null` no longer 503s; a weighing outside 30–350 kg
  no longer breaks Settings, and deleting the newest weighing hands the calculator the
  one before. Barcodes read "1 portion (60 g)" and litre bottles right. Uploads are read
  only up to their limit and images are checked for size before decoding (decompression
  bombs), off the event loop. A refused refresh clears its cookie, a clashing write is a
  409, the docker hint stays local, the demo ignores a far-off clock and its cleanup can't
  delete a demo kept a moment earlier, a moved reminder doesn't fire twice, search ranks
  "chicken" before "chickpeas". Frontend: today moves at midnight in an app left open; a
  day, a Library shelf or Settings that failed to load says so; decimal fields take a
  comma; saving waits for a sentence still being read; only changed targets are sent;
  one person's diary never shows in the next session on the same tab; "no connection"
  and "can't be played on this device" in place of "Is the backend running?"; the
  microphone explains an http page; "Serbian", not "Srpski"; "Calories:" pastes.
  Also: recipe steps, notes, aliases and a paste's pieces are bounded, the PDF export is
  built off the event loop, and Progress reloads after a "+" add.
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
