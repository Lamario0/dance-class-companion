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
| 2 | Admin attendance tools: manual check-in (including people without an account, admin-added only), per-class headcount and who came | specced below |
| 3 | Google Sheet sync both ways: each check-in becomes a row in an Attendance tab; slot titles editable in a Slots tab and read back by the app | not specced |
| 4 | Android: scanning a QR opens the app (app links) and/or an in-app scanner | not specced |
| 5 | Levels and progress: classes toward the next level, shown to students | not specced |

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
