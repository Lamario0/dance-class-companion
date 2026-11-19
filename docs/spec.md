# Dance Class Companion attendance - spec

(The finished accounts project's spec is in `docs/accounts-spec.md`.)

## Goal

This exists so the studio knows who came to each class and students can see
their own attendance (and later progress toward levels); the first version is
done when an admin can create class slots with printable QR codes, a signed-in
student scanning one is checked into that slot's current class (once per day),
the admin can check someone in by hand, and each check-in lands in the Google
Sheet.

- **Used by:** students (check in, see their attendance) and admins (slots,
  QR codes, manual check-ins, headcounts).
- **First version is done when:** all of slices 1-3 are live on
  danceclasscompanion.com.

## Out of scope

- The calculator / dance-party attendance (separate, untouched).
- Passes, payments and "classes left" tracking.
- Time windows or rotating codes: QR codes are static and always open.
- Location checks.

## Slices

Only the current slice is specced. Later ones are specced when reached.

| # | Slice | State |
|---|---|---|
| 1 | Slots + QR check-in: admins create slots with printable QR codes; a signed-in student scans and is checked into the slot's current class (once per day); "My attendance" page | done (live 2026-11-18) |
| 2 | Admin attendance tools: manual check-in (including people without an account, admin-added only), per-class headcount and who came | done (live 2026-11-18) |
| 3 | Syllabus-driven classes and sheet sync: class cards come from a Classes worksheet built from the syllabus; slots in a Slots worksheet both ways (3A); every check-in becomes an Attendance row (3B) | done (live 2026-11-18) |
| 4 | Android: scanning a class QR opens the app (app links), plus a "Scan to check in" scanner in the menu; ships as 1.3.0 | done (verified on phone 2026-11-18; 1.3.0 awaiting Play upload) |
| 5 | Levels and progress: per-dance levels (100 / 200 / Advanced Concepts), progress shown to students, admin confirms moves up, guests linkable to accounts | done (live 2026-11-19) |

---

## Slice 5 - Levels and progress

### What it does

- **Levels per dance:** each student has a level in each dance: 100
  (Basics), 200 (Intermediate) or Advanced Concepts. Everyone starts at 100.
- **Progress for students:** "My attendance" gets a progress card per dance
  they have attended: classes counted toward the next level, time since
  their first counted class, and what is unlocked. Example: "WCS - 100 level:
  9 of 12 classes, 2 of 4 months".
- **AB first:** if a dance has an AB class, it must be attended before that
  dance's 101/102/... count; until then the card says "Start with AB".
- **Ready -> admin confirms:** when a student meets a target, the admin sees
  them in a "Ready to move up" list and confirms (or leaves them). Advanced
  Concepts is invite only: meeting its minimum only makes them eligible; the
  admin confirms the invite the same way.
- **Show + warn, never block:** a check-in to a class above the student's
  level still works, but is flagged ("above level") on the admin's class
  attendance list.
- **Guest linking:** an admin can link a guest (admin-added, no account) to a
  student account; the guest's check-ins move to that account and count.

### Rules (from the user)

| Move | Requirement |
|---|---|
| 100 -> 200 | at least 12 classes at 100 level (after AB, if the dance has one) AND at least 4 months since the first of them, then admin confirms |
| 200 -> Advanced Concepts | at least 6 months since the first 200-level class AND at least N 200-level classes (N set by the admin, default 24), then admin invites |

### Confirmed decisions

| Decision | Choice | Why |
|---|---|---|
| Moving up | Counts make a student "ready"; an admin confirms | User choice |
| Where targets live | The app's admin page (not the sheet) | User choice |
| Counting | 100-level classes toward 200; 200-level toward ADV; AB required first where it exists | User's rules |
| Locked classes | Show + warn; check-in never refused | User choice |
| Time | Minimum classes plus months since the first counted class | User choice |
| Class level | Read from the class title: "AB", 1xx, 2xx, "ADV Concepts" | User choice |
| Scope | Per dance | User choice |
| Guests | Admin links a guest to an account; its check-ins move over | User choice |
| Admin overrides | An admin can promote a student at any time, to any level (including Advanced Concepts), without the requirements being met | User choice |
| Maximum level | An admin can set a per-dance cap for a student; they never show as "ready" past it, and promotions above it are refused until the cap is raised or cleared | User choice |

### Defaults to confirm (Claude's recommendation; say if any is wrong)

1. **Admin settings:** the 12 classes / 4 months / 6 months / 24 classes are
   editable on the admin page per level (same for every dance).
2. **Existing check-ins count:** past check-ins (since slice 1) count from day
   one; nobody is moved up automatically.
3. **A class counts once per day** (as check-ins already are).
4. **Admins can move someone back down.**
5. **Titles the app can't place** (no AB/1xx/2xx/ADV) count toward nothing and
   are listed for the admin so the title can be fixed in the sheet.
6. **Levels are kept in Firestore** on the student's profile, written only by
   Netlify functions (students can't change their own). The sheet gets no
   level column in this slice.
7. **Linking a guest is undoable** by the admin (unlink moves the check-ins
   back to the guest name); Attendance rows are renamed to the account name
   by the existing rename sync.

### Done means

| # | Criterion | Checked by |
|---|---|---|
| 1 | Class titles map to levels: "AB" -> AB, 101/102/1xx -> 100, 2xx -> 200, "ADV Concepts n" -> ADV, anything else -> unplaced | unit test over the real WCS titles |
| 2 | Progress counts only same-dance, current-level classes, once per day, and only after AB where the dance has one | function test against the emulators |
| 3 | A student with 12 counted 100-level classes over 4+ months shows as "ready" for 200; 11 classes, or under 4 months, does not | function test (backdated check-ins) |
| 4 | ADV eligibility needs both 6 months since the first 200-level class and N 200-level classes; changing N on the admin page changes the result | function test |
| 5a | An admin can promote a student who is not ready, straight to any level; a cap stops "ready" at the cap and refuses promotions above it until raised | function test |
| 5 | Only an admin can confirm a move, set a level or cap, or link a guest; a student's request is refused, and Firestore rules stop students writing their level | function test + rules test on the emulator |
| 6 | "My attendance" shows a card per attended dance with counts, months, and "Start with AB" when needed | browser preview at 375 px and desktop against the emulators |
| 7 | Admin page: "Ready to move up" list with confirm; level settings; promote/set level and cap per student; guest link and unlink | browser preview against the emulators |
| 8 | A check-in above the student's level succeeds and is flagged "above level" on the class attendance list | function test + browser preview |
| 9 | Linking a guest moves its check-ins to the account (progress updates, Attendance rows renamed on the next sync); unlinking restores them | function test with the fake workbook |
| 10 | All tests pass; `npm run build` passes, main bundle under 330 kB; the calculator is untouched | test and build output, diff |

### Reference to match

The existing "My attendance" page and admin pages (slices 1-2) for layout and style.

### Second check

Fresh-context reviewer subagent with this spec, the criteria and the diff.

---

## Slice 4 - Android: QR codes open the app

### What it does

- **App links:** on an Android phone with the app installed, scanning a
  class QR with the camera (or tapping a `https://danceclasscompanion.com/checkin/<slot>`
  link) opens the app straight to that check-in, instead of the browser.
  Works whether the app was closed or already open. Without the app, the
  link opens the website as today.
- **In-app scanner:** a "Scan to check in" item in the left menu (Android app
  only). It opens the phone's QR scanner; a class code checks you in, any
  other code says "That's not a class code", and backing out returns to the
  app.
- Ships as **1.3.0 (versionCode 12)**. 1.2.0 is never uploaded: 1.3.0
  includes everything in it.

### Confirmed decisions

| Decision | Choice | Why |
|---|---|---|
| Scope | App links and an in-app scanner | User choice |
| Scanner button | Left menu only (next to My attendance); the Classes tab is unchanged | User choice |
| Release | Skip 1.2.0; ship 1.3.0 (versionCode 12) to Play internal testing | User choice: one upload and one review |

### Defaults to confirm (Claude's recommendation; say if any is wrong)

1. **Only check-in links open the app.** Other danceclasscompanion.com pages
   keep opening in the browser.
2. **Verified links:** the site serves `/.well-known/assetlinks.json` naming
   the app (`com.danceclasscompanion.app`) and both signing keys (the upload
   key and Play's app-signing key), so Android opens the app without asking
   "open with?". (Build note: Play's app-signing key is the same `dcc-release-key`
   as the upload key, so the file lists one fingerprint, which matches both.)
3. **Scanner:** Google's built-in code scanner (through Play services), so
   the app needs **no camera permission**. It is loaded only when used, so
   the website's bundle doesn't grow.
4. **Same check-in flow as a scan in the browser:** signed out → sign in
   first; unverified → "Check your email"; once per slot per day.
5. **iOS** stays out of scope (no Apple developer account yet).

### Done means

| # | Criterion | Checked by |
|---|---|---|
| 1 | `https://danceclasscompanion.com/.well-known/assetlinks.json` is served as JSON with the package name and both SHA-256 fingerprints | curl after deploy |
| 2 | Android reports the link as verified for the app | `adb shell pm get-app-links com.danceclasscompanion.app` on the user's phone |
| 3 | Scanning a class QR with the phone camera opens the app to that check-in and completes it (signed in, verified), both when the app was closed and when it was open | user's phone (Claude watches logcat) |
| 4 | Other site links (e.g. the home page) still open the browser | user's phone |
| 5 | "Scan to check in" appears in the menu only in the Android app; a class code checks in, a non-class code shows "That's not a class code", backing out returns to the app; no camera permission is requested | user's phone + browser preview (item hidden on the web) |
| 6 | The website is unchanged apart from serving assetlinks.json; `npm run build` passes, main bundle under 330 kB | build output + browser preview |
| 7 | A signed 1.3.0 / versionCode 12 AAB is built and its signature verified; the APK installs over 1.2.0 on the user's phone | apksigner/jarsigner output + `adb install -r` |

### Reference to match

Slice 1's check-in screen (what a scan in the browser does today).

### Second check

Fresh-context reviewer subagent with this spec, the criteria and the diff.

---

## Slice 3 - Syllabus-driven classes and Google Sheet sync

Built and shipped in two parts, each its own PR: **3A** (class content from
the syllabus, slots in the sheet) and **3B** (attendance rows).

### The workbook (set up 2026-11-18)

The "Syllabus" workbook (`1VuTfGDldybCC8Lv0FSQG8acMSQ681X93NgUVAXg89Ls`) now
has three new worksheets:

- **Classes** - one row per class column of every *dance worksheet*:
  Dance | Class | Patterns covered | Notes | Column. Class, Patterns covered
  and Column are live formulas pointing at the dance worksheet, so a ticked
  box or a renamed title shows at once, and inserting columns in a dance
  worksheet doesn't break them. **Notes** is typed by hand: it is what
  students see as the instructor notes. 30 WCS rows exist now.
- **Slots** - Slot | Class | Archived | Slot ID. Class is a dropdown of the
  titles in Classes. Empty until 3A fills it from the app.
- **Attendance** - Date | Slot | Name | Class | Time | How | Guest |
  Check-in ID. Date shows `11-18-2026`, Time `7:04 PM`. Empty until 3B.

**Dance worksheet layout** (WCS is the model; Carolina Shag, C2S, Modern
Hustle, NC2S, Salsa and Waltz will be converted to it by the user):

- Row 1: a class title, with its checkbox column directly to the right.
- Under it, the patterns/content for that class, each with a checkbox.
- A green row reading "Technique" or "Basic Patterns or Technique" ends the
  patterns. Below it is the instructor's own technique/notes area, never
  shown in the app.
- A grey empty column separates levels.
- Not dance worksheets: "webapp data", "Random Notes", "Classes", "Slots",
  "Attendance". A worksheet counts as a dance worksheet only once row 1 has
  a title with a checkbox to its right, so unconverted ones are skipped.

### What it does

**3A - classes and slots**
- **Classes stays complete:** a server job (every 15 min, plus a "Refresh
  class list" button on the admin Class slots page) adds a Classes row for
  any new class column or newly converted dance worksheet. It never edits
  Notes and never deletes a row; a row whose column was deleted shows an
  error and is highlighted for the user to remove.
- **The app's class cards come from Classes:** the home screen shows one
  card per *active slot*: the slot's class title, its day/time, the patterns
  ticked for that class, and its Notes. The class block in "webapp data"
  (rows 1-5) is no longer read; songs, videos and announcements still are.
- **Slots both ways:** creating, editing or archiving a slot in the app
  writes its Slots row. Changing a slot's Class (or its Slot label) in the
  sheet changes it in the app: read on each load like class content today,
  and read again by the server at check-in so the check-in records it.
  Slots are only created in the app.
- The app's slot editor picks the class from the Classes titles instead of
  free text.

**3B - attendance rows** (specced 2026-11-18, see "3B detail" below)
- Every check-in (QR or admin-added) becomes an Attendance row as it happens.
  Rows read newest day first. Time is the QR scan time, blank for
  admin-added. Guest says "yes" for guests. Removing a check-in deletes its
  row.
- Renaming a student profile or a guest updates their name on every
  check-in and Attendance row. Deleting an account relabels its check-ins
  and rows "Former student".
- If the sheet can't be reached, the check-in still succeeds; the 15-minute
  job writes waiting rows, deletions and renames. Check-ins from before 3B
  are written on the first run.

### Confirmed decisions

| Decision | Choice | Why |
|---|---|---|
| Worksheets | Classes, Slots, Attendance in the Syllabus workbook | User choice |
| Classes source | Row-1 titles of every dance worksheet; patterns = ticked boxes above the green Technique row | User choice |
| What the app shows | Classes of active slots (one card per active slot) | User choice |
| Instructor notes | The Notes column in Classes, typed by hand; the technique area stays private | User choice |
| Other dances | Converted to the WCS layout by the user; skipped until then | User choice |
| Slots | Third worksheet; Slot, Class, Archived, Slot ID; renaming the Slot label in the sheet renames it in the app; slots only created in the app | User choice |
| Which value wins | The Slots worksheet's label and class when the slot has a row there; otherwise the app's own | App edits also write the sheet |
| Title read-back | Instantly, on each load, like class content today; the server re-reads at check-in | User choice |
| Attendance | Columns as above; date `11-18-2026`, time `7:04 PM` studio time; Time blank for admin-added; newest at top | User choice |
| Removals | Delete the Attendance row; hand edits to Attendance are not read back | User choice |
| Sheet down | Check in, sync later (job every 15 min); backfill on first run | User choice |
| Access | Sheets API with the existing service account, shared on the workbook as Editor; the browser keeps reading through the public link (gviz) | User OK'd sharing |
| Privacy | Accepted: the workbook is link-viewable, so Attendance (names, dates, classes; no emails) can be read by anyone with the link | User choice |
| Classes formulas | Live sheet formulas, not code, so ticking a box needs no sync | Instant, and survives column inserts |

### Defaults to confirm (Claude's recommendation; say if any is wrong)

1. **Unique titles:** class titles must be unique across the workbook (a
   slot names its class by title). Repeats are highlighted in Classes, and a
   slot pointing at a repeated title uses the first one. WCS has "ADV
   Concepts" six times, so rename those before putting one on a slot.
2. **Asterisks:** leading/trailing `*` in pattern names are stripped in the
   app ("**Release Whip" shows as "Release Whip"); the sheet keeps them.
3. **Card order:** home cards are ordered by slot creation order (the order
   in the Slots worksheet).
4. **Student notes:** class notes stay keyed by class title, so when a slot
   moves from 201-B to 201-C the next week's note is a new entry under
   "Intermediate 201-C". Notes under old names ("WCS Intermediate 201") stay
   in My notes.
5. **Sheet unreachable on load:** the home screen shows the friendly error it
   shows today; check-ins don't depend on it.

### User actions before building

- Share the workbook with the service account's email as **Editor**.
- Enable the **Google Sheets API** in the Google Cloud project
  `dance-class-companion` (Claude gives the link).

### Done means - 3A

| # | Criterion | Checked by |
|---|---|---|
| 1 | Classes has exactly one row per titled class column in each dance worksheet; ticking/unticking a box above the green row changes Patterns covered at once; nothing below the green row appears | sheet read via the Sheets connector (already true for WCS) + user ticks a box |
| 2 | The job/button adds a row for a new class column and for a newly converted worksheet; running it twice adds nothing; Notes and existing rows are never changed or deleted | function test against a test spreadsheet |
| 3 | The home screen shows one card per active slot with the class title, day/time, ticked patterns and Notes from Classes; a class not found shows the title with "Patterns TBD" | browser preview (phone + desktop) against emulator slots and the live sheet (read only) |
| 4 | Changing a slot's Class or Slot label in the Slots worksheet shows on the home, check-in and admin pages on the next load, and the next check-in records it | browser preview + function test |
| 5 | Creating, editing or archiving a slot in the app creates/updates its Slots row; the slot editor offers the Classes titles | function test + test spreadsheet + browser |
| 6 | Songs, videos and announcements still load from "webapp data"; no code writes "webapp data", the dance worksheets or "Random Notes" | browser + code review |
| 7 | Only server code with the service account writes the sheet; the browser never can | code review + function tests |
| 8 | `npm run build` passes; main bundle under 330 kB | build output |

### 3B detail

**Confirmed (2026-11-18)**

| Decision | Choice | Why |
|---|---|---|
| When rows appear | At check-in. The function waits up to ~3 s for the sheet; on failure or timeout the check-in still succeeds and the job writes the row | User choice |
| Row order | By date, newest day first: a row goes above the first row with the same or an earlier date, so late rows (sheet was down, past-day adds, backfill) land in the right day | User choice |
| Renames | A renamed student or guest shows the new name on all their check-ins (app and sheet) | User choice |
| Deleted accounts | Their check-ins stay (headcounts stay right), relabelled "Former student" with no link to the account, in the app and the sheet, like chat | User choice |

**How it works (Claude's design; say if any is wrong)**

- Columns (reordered 2026-11-18): Date (`11-18-2026`) | Slot (label recorded at
  check-in) | Name | Class (title recorded at check-in) | Time (`7:04 PM`,
  studio time, QR only) | How (`QR` / `Added`) | Guest (`yes` / blank) | Check-in ID.
- Each check-in gets a `sheet` field: `synced` once its row is written,
  `pending` until then. Removals the sheet hasn't seen yet are kept in a
  server-only `sheetDeletes` list, so a removal is never lost. Renames the
  sheet hasn't seen mark the check-ins `pending` again, and the job rewrites
  those rows.
- Rows are found by Check-in ID (never by row number alone), so sorting or
  hand-editing other columns doesn't confuse the sync. A row typed by hand
  without an ID is left alone. A row whose ID no longer exists in the app
  is left alone too (hand edits aren't read back).
- A student rename is reported by the app to a new server function, which
  checks the caller and reads the new name from the profile itself, then
  updates their check-ins. A guest rename goes through a new admin function
  the same way. Running both on every rename keeps the 15-minute job from
  having to scan all check-ins.
- Account deletion (self or admin) relabels the check-ins in the same server
  code that already relabels chat (`netlify/lib/accounts.mts`).
- Rows are written as plain text except Date and Time, which are written as
  real date/time values (so the sheet can sort and filter them); a name
  starting with `=` never becomes a formula.
- No Firestore rules change: check-ins stay server-only, and `sheetDeletes`
  is covered by the "everything else locked" rule.

### Done means - 3B

| # | Criterion | Checked by |
|---|---|---|
| 1 | A QR check-in and an admin-added check-in each add exactly one Attendance row with the agreed columns and formats (Time blank for admin-added) | function test against the in-memory workbook + user looks at the real sheet after deploy |
| 2 | Rows read newest day first: a past-day add and a late (synced afterwards) row land within their own day, above older days | function test |
| 3 | Removing a check-in deletes its row and only that row, found by Check-in ID even after the sheet was sorted | function test |
| 4 | With the sheet unreachable, check-ins and removals still succeed; the next job run writes the rows and deletions, with no duplicate rows | function test (sheet failing, then working) |
| 5 | The first run writes all earlier check-ins once, each in its day; running it twice adds nothing | function test |
| 6 | Renaming a student profile or a guest updates the name on all their check-ins and Attendance rows (now, or on the next job run if the sheet is down); only the student themself or an admin can trigger it, and the name always comes from the stored profile/guest | function test + browser (rename in the account sheet and on Admin > Attendance) |
| 7 | Deleting an account (self or admin) relabels its check-ins and rows "Former student" and drops the account link; headcounts don't change | function test |
| 8 | A QR check-in with the sheet down or slow still answers within ~4 s | function test (slow fake sheet) |
| 9 | Only server code writes the Attendance worksheet; no other worksheet is written by 3B | code review + function tests |
| 10 | `npm run build` passes; main bundle under 330 kB | build output |

### Reference to match

The WCS worksheet (layout) and the Classes worksheet as set up on 2026-11-18
(what the app should show for each class).

### Second check

Fresh-context reviewer subagent with this spec, the criteria and the diff,
for each of 3A and 3B.

---

## Slice 2 - Admin attendance tools

### What it does

- **Admin > Attendance** (new item in the left menu's Admin section, next to
  Class slots): a date picker (defaults to today in Grand Rapids; past days
  allowed, no future days). For that date, each slot shows its **headcount**
  and **who came** (name, a QR / added-by-admin tag, time).
- **Add person** on a slot: search accounts (name or email) or the **guest
  list**, or create a new guest by name. Adds a check-in for that slot and
  date. Someone already checked in that day is shown as "already here".
- **Guests** are people without an account. An admin adds a guest once; after
  that they are picked from the list, so their attendance adds up. Guests can
  be renamed.
- **Remove** any check-in (QR or manual), after a confirm. It is deleted, so it
  also drops off that student's My attendance.
- Students see manual check-ins on My attendance the same as QR ones.

### Confirmed decisions

| Decision | Choice | Why |
|---|---|---|
| People without accounts | Saved guest list (`guests/{id}`: name, createdAt, createdBy); admins only | User choice: attendance adds up per person |
| Dates | Today and past days; never future | User choice: add forgotten check-ins |
| Removing | Admins can remove any check-in (hard delete, with confirm) | User choice |
| Where | New Admin > Attendance page; Class slots stays for QR setup | User choice |
| Write path | `POST /api/admin/checkin` (add) and `POST /api/admin/checkin-remove`, each checking a verified, non-revoked admin token like the other admin functions; the browser still never writes check-ins | One trusted place for check-in writes (and the slice 3 sheet write) |
| Record shape | Same `checkins` collection and id scheme: `slotId__date__uid` for accounts, `slotId__date__g_<guestId>` for guests; adds `method: 'manual'`, `addedBy` (admin uid) and `guestId` for guests | Once-per-slot-per-day holds for manual too; QR and manual can't double up |
| Title for a past date | The title already recorded on that slot's check-ins that day, else the slot's current title | Slots don't keep title history |
| Slots listed on a date | Active slots, plus any archived slot that has check-ins that date | Old classes stay visible; new check-ins go to active slots |
| Account search | Reuse the admin accounts list (`/api/admin/users`), filtered in the browser | Already exists; small studio |

### Assumptions to confirm

- Linking a guest to an account when they later sign up (moving their history
  over) is **not** in slice 2; it is noted for later (levels, slice 5, needs
  it). Guest check-ins are kept so they can be linked then.
- Guests are renamed but not deleted in slice 2 (deleting would orphan their
  check-ins).
- Guest check-ins go into headcounts and the sheet (slice 3) like anyone else's.

### Done means

| # | Criterion | Checked by |
|---|---|---|
| 1 | Admin > Attendance shows, for the chosen date, each slot's headcount and names with a QR / manual tag; a future date can't be picked | browser preview against the emulators |
| 2 | An admin adds an account holder to a slot on today or a past date; it appears in the list and on that student's My attendance with the right date and title | browser + emulator data + function test |
| 3 | An admin creates a guest, checks them in, and next time finds them in the guest list; renaming a guest shows the new name | browser + emulator data |
| 4 | Adding someone already checked in to that slot that day (by QR or manually) makes no second record and says "already here" | function test + browser |
| 5 | Removing a check-in deletes it after a confirm; the headcount and the student's My attendance update | browser + function test |
| 6 | Non-admins (and unverified or revoked admins) get 401/403 from both functions; students can't read or write `guests`; future dates and unknown slots/people are refused | function tests + rules tests |
| 7 | A past date's list shows the title recorded that day; archived slots with check-ins that day still show | function test / emulator data + browser |
| 8 | `npm run build` passes; main bundle under 330 kB (Attendance page lazy-loaded) | build output |
| 9 | Works at 375px and desktop; 44px tap targets | browser preview + user looks |

### Reference to match

Slice 1's `SlotsPage` (cards, bottom sheets, empty states) and the accounts
project's `StudentsPage` (account list and search).

### Second check

Fresh-context reviewer subagent with this spec, the criteria and the diff.

---

## Slice 1 - Slots and QR check-in

### What it does

- **Admin > Class slots** (new item in the left menu's Admin section): create
  a slot with a label (e.g. "Tue 7:00pm") and the class currently taught in it
  (e.g. "WCS 201"); edit the title any week; archive a slot. Each slot shows
  its **QR code** with Download/Print, and the link it encodes.
- The QR encodes a permanent link, `https://danceclasscompanion.com/checkin/<slotId>`.
  Changing the slot's title never changes its QR.
- **Scanning** with a phone camera opens that link:
  - signed in with a verified account → "You're checked in to WCS 201 ·
    Tue 7:00pm" with a little celebration;
  - already checked in to that slot today → "You're already checked in today";
  - signed out → the sign-in sheet first, then the check-in completes;
  - unverified email → the "Check your email" step first;
  - unknown/archived slot → a friendly "This code isn't active" screen.
- **My attendance** (left menu, signed-in users): total classes, count per
  class title, and a dated list of check-ins, newest first.

### Confirmed decisions

| Decision | Choice | Why |
|---|---|---|
| What a QR belongs to | A slot created in the admin page (label + current class title); the QR never changes | User choice: titles change week to week |
| Restriction | Static, always open; once per slot per studio day | User choice |
| Who checks in by QR | Signed-in, verified students | User choice; people without accounts are added by admins (slice 2) |
| Studio day | America/Detroit (Grand Rapids) calendar day | "Once per day" must not depend on the phone's time zone |
| Check-in path | `POST /api/checkin` Netlify function: verifies the token, resolves the slot's current title, computes the studio day, writes Firestore | One trusted place for the once-per-day rule and (slice 3) the sheet write |
| Data | `slots/{slotId}` (label, title, archived, createdAt); `checkins/{slotId__YYYY-MM-DD__uid}` (uid, name, slotId, slotLabel, title, date, at). Students read only their own check-ins; admins read all; nobody writes check-ins from the browser | Deterministic id = once per day; server-only writes |
| Link routing | Netlify rewrite `/checkin/*` -> the app; the app reads the slot id from the path | No SPA fallback exists today |
| QR generation | In the browser (small library, lazy-loaded on the admin page); PNG download + print | No server or third-party QR service |
| Sheet | Not in slice 1 (slice 3: both ways via the Google Sheets API using the existing service account; the sheet must be shared with it) | Keeps slice 1 small |
| Android | Slice 1 works in the browser; in the app, scanning opens the website for now (slice 4 adds app links) | Keeps slice 1 small |

### Done means

| # | Criterion | Checked by |
|---|---|---|
| 1 | An admin creates a slot (label + title); it appears in Class slots with a QR that encodes `/checkin/<slotId>`; Download gives a PNG; Print shows a printable page | browser preview against the emulators; decode the QR image |
| 2 | Editing a slot's title keeps the same slot id and QR; archiving hides it from new check-ins | browser preview + emulator data |
| 3 | A verified student opening the link is checked in and sees the class title and slot label; a second scan the same studio day says already checked in (no second record) | browser preview + emulator data + function test |
| 4 | Signed out → sign-in first, then the check-in completes; unverified → "Check your email" first | browser preview |
| 5 | Unknown or archived slot → "This code isn't active"; nothing written | function test + browser |
| 6 | "Once per day" uses the America/Detroit date (a check-in at 11:30pm local and 12:30am local are different days; 11pm and 11:30pm are the same) | function test |
| 7 | Rules/API: students can't write check-ins or slots from the browser; non-admins can't create/edit slots; a student can read only their own check-ins; admins can read all | rules tests + function tests |
| 8 | My attendance shows total, counts per class and a dated list for the signed-in student only | browser preview |
| 9 | `npm run build` passes; main bundle under 330 kB (admin slots page and QR code lazy-loaded) | build output |
| 10 | Works at 375px and desktop; 44px tap targets; the check-in screen is clear on a phone held at arm's length | browser preview + user looks |

### Reference to match

The left-menu pages from the accounts project (`NotesPage`, `StudentsPage`)
and the app's empty/celebration states (`components/ui/Doodles.tsx`).

### Second check

Fresh-context reviewer subagent with this spec, the criteria and the diff.

### Open questions

- None for slice 1. (Slice 3 will need the Google Sheet shared with the
  service account's email.)
