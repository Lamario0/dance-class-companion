# Decisions

Dated log of confirmed decisions. Don't re-decide what is logged here.

## 2026-11-17 - Attendance kickoff

- Goal: headcount per class, student progress, and (later) progress toward levels. Not passes/payments.
- QR codes are static and always open, one per **slot** (e.g. "Tue 7:00pm") created in the admin page; the slot's current class title can change without changing its QR. Once per slot per studio day (America/Detroit).
- Signed-in, verified students check in by QR. People without an account are checked in only by admins (manual check-in, slice 2).
- The Google Sheet syncs both ways (slice 3): check-ins become rows (date, time, slot, class, name; no email); slot titles can be changed in the sheet and are read back by the app.
- Students get a "My attendance" page from the first slice; levels come later.
- Check-ins go through a server function (`/api/checkin`); QR links are `https://danceclasscompanion.com/checkin/<slotId>`; QR codes generated in the browser.
- Main bundle limit raised from 320 to 330 kB.
- Guardrails added: ask before editing the calculator files and before `firebase deploy`.

## 2026-11-19 - Slice 5 (levels) spec and build

- Levels per dance: 100 / 200 / Advanced Concepts. 100->200 needs 12 classes at 100 level (after AB where the dance has one) and 4 months; 200->ADV needs 6 months and 24 200-level classes; ADV is invite only. Targets are editable on the admin Levels page.
- Counts make a student "ready"; an admin confirms. Admins can also promote anyone to any level at any time, move them down, and set a per-dance maximum level that stops "ready" and refuses promotions above it.
- Show + warn: a check-in above a student's level still works and is flagged "Above level" on admin Attendance.
- Class level comes from the title: AB; Basics or 1xx -> 100; Intermediate or 2xx -> 200; ADV/Advanced -> ADV. Titles it can't place, or that aren't in the Classes worksheet, count toward nothing and are listed on the Levels page.
- Guests can be linked to an account (check-ins move over, keep `linkedGuestId`) and unlinked. Deleting a linked account unlinks first. A linked guest can't be checked in as a guest.
- Levels live in `levels/{uid}` and targets in `settings/levels`, written only by /api/admin/levels.
- Known edge: linking on the same class day as the account's own later check-in can leave two rows for that class; counting still counts it once.

## 2026-11-18 - Slice 4 done

- Verified on the user's phone (SM-F946U): link verified by Android, camera scans open the app (closed and open), other links stay in the browser, menu scanner checks in / rejects other codes / backs out, no camera permission.
- Release: 1.3.0 (versionCode 12) AAB built and signed; upload to Play internal testing is the user's step.
- CLAUDE.md: last versionCode is now 12.

## 2026-11-18 - Slice 4 (Android app links + scanner) spec

- Scope: app links (class QR codes open the app) and an in-app scanner, reached from the left menu only.
- 1.2.0 (versionCode 11) is never uploaded; slice 4 ships as 1.3.0 (versionCode 12) to Play internal testing.
- Slice 3 (3A + 3B) is live as of 2026-11-18 (PRs 12-15).

## 2026-11-18 - Attendance slice 3 (syllabus-driven classes, sheet sync)

- Scope grew: class content now comes from the syllabus itself. New worksheets in the Syllabus workbook: **Classes** (one row per class column of every dance worksheet; live formulas; Notes typed by hand), **Slots** (Slot, Class, Archived, Slot ID; Class is a dropdown of Classes titles), **Attendance** (Date, Time, Slot, Class, Name, How, Guest, Check-in ID). Set up by Claude through the Sheets connector on 2026-11-18.
- Dance worksheets follow the WCS layout: row-1 titles with a checkbox column to the right, patterns above a green "Technique"/"Basic Patterns or Technique" row, the instructor's private technique/notes area below, grey columns between levels. Only ticked patterns above the green row reach the app. The other dances will be converted by the user and are skipped until then.
- The app shows one class card per active slot (its class's title, ticked patterns and Notes). The "webapp data" class block is retired; songs, videos and announcements stay there.
- Slots: only created in the app; label and class editable in the sheet and read back on each load and at check-in; the sheet wins when a row exists.
- Attendance: date `11-18-2026`, time `7:04 PM` (scan time; blank for admin-added), newest at the top; removal deletes the row; sheet down → sync later (15-minute job); backfill on first run.
- Sharing the workbook with the service account as Editor is OK. Accepted: the link-viewable workbook exposes Attendance names to anyone with the link.
- Built as two PRs: 3A (classes + slots), 3B (attendance rows).
- Spec and its five defaults approved by the user (unique titles across the workbook, asterisks stripped in the app, cards in Slots order, class notes keyed by title, sheet-down shows today's error).
- 3A build: slots are now saved through `/api/admin/slot` (server writes Firestore + the Slots row) instead of from the browser; the slots rules are unchanged, so no rules deploy. A `sheetPending` flag marks app edits the sheet hasn't seen; the job pushes those and otherwise pulls sheet edits (with an update-time precondition, so a newer app edit wins). Until the Slots worksheet has rows, the home screen keeps using the old "webapp data" class block.

- Attendance columns reordered by the user: Date, Slot, Name, Class, Time, How, Guest, Check-in ID.
- 3A shipped (PR 12, merged 2026-11-18).
- 3B build: Attendance writes take turns through a short Firestore lease (`sheetSync/attendanceLock`), so a scan inserting a row can't shift rows under an admin's removal or rename. Check-ins spend at most ~3 s on the sheet in all; otherwise the job writes the row.
- Accepted (3B): a deleted account's check-ins drop `uid` and the name, but the Check-in ID (`slot__date__uid`, the document id and the sheet's ID column) still contains the old Firebase uid. Uids aren't secrets and the account no longer exists; re-keying documents was judged not worth it (same reasoning as chat's readable uids).
- 3B answers: Attendance rows are written at check-in (sheet failure never blocks a check-in; the job catches up); rows are ordered by date, newest day first, including late and past-day rows; renaming a student or guest updates their name on all check-ins and rows; deleted accounts' check-ins stay, relabelled "Former student" with no account link (same as chat).

## 2026-11-18 - Attendance slice 2 (admin tools)

- Approved: guests are a saved list (`guests/{id}`, admins only, renamed never deleted); admins check people in for today or past days, never future; any check-in (QR or manual) can be removed (hard delete); a new Admin > Attendance page holds headcounts and who came.
- Manual check-ins use the same `checkins` id scheme (`slotId__date__uid`, guests `slotId__date__g_<guestId>`), so a QR scan and a manual add can't double up. Written only by `/api/admin/checkin` and `/api/admin/checkin-remove`.
- A past day's check-in takes the title already recorded that day for the slot, else the slot's current title. New check-ins only go to active slots; archived slots still show on days they have check-ins.
- Guest names in the admin list are live (a rename shows everywhere); account names are the snapshot taken at check-in, as in slice 1.
- The list shows a time only for QR scans; a manual add's time is when the admin typed it.
- "The title recorded that day" = the day's first check-in for that slot (earliest time), in both the function and the page, so they agree if a title is changed mid-day.
- Accepted: guests are read and renamed straight from the browser under the rules, so (like chat moderation) a just-removed admin can still do that for up to an hour; the two check-in functions refuse them at once.
- Accepted: an admin can add a check-in for a past day before the slot existed; it takes the slot's current title.
- Not in slice 2: linking a guest to an account later (needed for levels, slice 5).

## 2026-11-17 - Attendance slice 1 build notes

- Known limitation (follows from "static, always open"): anyone with a slot's link (a photo of the poster, a shared link) can check in from anywhere. Still once per slot per day, and only for verified accounts. Revisit if it's abused (e.g. a rotating code or an admin review in slice 2).
- The check-in, Class slots and My attendance pages don't wait for the Google Sheets class data, so a scan works even when the sheet is slow or down.
- After a check-in the address bar goes back to `/`, so reloading doesn't re-run the check-in.
- `scripts/seed-emulator.mjs` makes local emulator test accounts (admin, student, unverified); it never touches the live project.

## 2026-11-17 - Accounts kickoff

- Roles are only **student** and **admin**; no instructor role. Admin is a Firebase custom claim, first granted to lamariow@gmail.com by script; admins can grant others (slice 4).
- The calculator keeps its triple-tap passcode and is out of scope for accounts.
- Sign-in: email + password (with reset) and Google. Apple skipped until the Apple Developer account and iOS app are real.
- Email accounts must verify their email before using Notes or chat edit/delete. Google accounts count as verified.
- Sign-in is optional; guests keep using the app and can still post in chat (without edit/delete).
- Notes: "my notes" per class plus a free notebook, private to each student.
- Admin screen (slice 4): moderate chat, see the student list, grant/remove admin.
- Deleting an account removes the login, profile and notes; chat messages stay, labelled "Former student".
- Ship to the website first; Android (native Google sign-in) follows as its own slice.
- Class attendance / QR check-in is the next project, after accounts.
- Guardrails: ask before pushing to `main` and before recursive deletes.

## 2026-11-17 - Slice 1 build notes

- Profiles are created by the account watcher for every sign-in path (popup, redirect, native), serialized per account so two writes never collide.
- Admin rights must always be enforced by Firestore rules / server checks on `request.auth.token.admin`, never by the UI badge (which can lag until the next page load). Applies to slices 3-4.
- Server functions only use the emulators with an explicit local opt-in (`DCC_USE_EMULATORS=1`) and never inside Netlify.
- Google's redirect fallback needs authDomain on our own domain: proxy rules are in `netlify.toml`; switching on needs `VITE_FIREBASE_AUTH_DOMAIN=danceclasscompanion.com` in Netlify plus the OAuth redirect URI (user action, pending). The popup path works without it.

- Stay on firebase-admin 13 (jwks-rsa 3 / jose 4). firebase-admin 14 breaks Netlify functions that verify tokens; `NODE_VERSION` in netlify.toml does not change the functions runtime. Revisit only after checking the Netlify functions Node version.
- Firebase project: the app's project is display name "dance class companion", ID `dance-class-companion`. The project displayed as "dance-class-companion" (ID `gen-lang-client-0566172369`) is the old AI Studio/Gemini project and is not used.
- lamariow@gmail.com has the admin claim on the live project (2026-11-17).

## 2026-11-17 - Slice 2 (Notes) spec approved

- Class notes are one dated entry per class per week (weeks start Monday), tagged with that week's pattern; keyed by class name.
- The notebook lives in the account sheet (nav stays at 3 tabs).
- Explicit Save button with a discard-changes prompt.
- Notes work offline (Firestore offline cache) and sync later.

## 2026-11-17 - Slice 3 (Chat identity) spec approved

- Members post under their account display name (edited in the account sheet); renaming updates their messages this quarter.
- Moderation by admin accounts only, enforced by Firestore rules; the calculator passcode no longer moderates chat and `chat-moderate` is removed.
- Own messages editable/deletable any time this quarter, marked "(edited)". Deleting a message with replies soft-deletes it ("This message was deleted").

## 2026-11-17 - Slice 5 (Android 1.2.0)

- Native Google sign-in via @capacitor-firebase/authentication (skipNativeAuth), signing the web SDK in with the Google ID token. Requires both the upload key's and Play's app-signing key's SHA-1/SHA-256 on the Firebase Android app.
- From the app, API calls go to https://danceclasscompanion.com; functions answer CORS only for https://localhost and capacitor://localhost (other Capacitor apps share that origin but can't get our tokens; accepted).
- Back button: leave fullscreen video, close the top sheet, close the menu, otherwise move the app to the background (not kill it), so unsaved notes survive. Escape closes only the top sheet.
- Follow-up (pre-existing): the calculator passcode endpoint (/api/admin-login) has no rate limit beyond a 300 ms delay.

## 2026-11-17 - Slice 4 (Students & roles)

- Admin page lists accounts (name, email, joined, last sign-in, method, verified, admin) via `/api/admin/users`; Make/Remove admin via `/api/admin/role`; delete a student via `/api/admin/delete-user` (same code as self-delete, `netlify/lib/accounts.mts`). Each function checks a verified admin token.
- Granting admin applies on the person's next page load (no sign-out). Removing admin revokes their refresh tokens (they're signed out on next refresh); an ID token they already hold can keep the claim for up to an hour, since Firestore rules don't check revocation. Accepted.
- Admins can't change their own role or delete themselves from this page. Admin functions check token revocation, so a removed/deleted admin loses the admin page immediately; only Firestore-rule powers (chat moderation) can linger up to an hour.
- Accepted: any admin can demote or delete another admin (including the founding one). Fine for a small trusted team; revisit if admins grow.

## 2026-11-17 - Slice 3.5 (left menu)

- Left menu for signed-in users only; My notes opens a full Notes page (not a nav tab); Admin section placeholder for slice 4; calculator stays on its passcode (only guarded against leaving unsaved notes).
- Leaving the Notes page with unsaved edits asks first from every in-app path (nav tabs, menu, logo triple-tap, sign out, account delete); reload/close uses the browser's "Leave site?" prompt. Not done: the Notes page has no history entry, so the Android back button leaves the app (with the browser prompt where supported). Revisit with slice 5 (Android).

## 2026-11-17 - Slice 3 build notes

- Chat deletes are always soft (text wiped, `deleted: true`); the UI hides them unless they have replies. Avoids orphaning a reply this device hasn't seen yet. TTL removes them with the quarter.
- "Studio Admin" and "Former student" are reserved everywhere (profile names, posts, renames).
- A verified member always posts as themselves; the guest path is for signed-out and unverified visitors only.
- Accepted: members' Firebase uids are readable on their chat messages (needed for ownership; uids aren't secrets). Old "Studio Admin" styling was dropped (no such posts exist in the live chat). A member post queued offline under an old name is refused after a rename.

## 2026-11-17 - Slice 2 build notes

- Two devices, same class + week: when the server is reachable, a save adds to the other device's text instead of replacing it (both the first save and a save after the note changed underneath). Known limit: if a device was offline and its cache never saw the other note, its sync replaces that note's text (accepted by the rules rather than silently dropped).
- Late sync refusals (after "Saved on this device") show a toast. In private browsing (no IndexedDB) the wording says to keep the page open instead of "will sync".
- Free notes can't take a class-note id; class names with no Latin letters get a hashed key.
- Known, accepted: devices in different time zones may disagree on the week around Monday midnight; offline chat posts queued past the end of a quarter are refused by the TTL/quarter rules.

## Earlier (redesign and chat, Nov 2026)

- Chat stored in Firestore `chatMessages`, current quarter only, deleted by a TTL policy on `expireAt` (Blaze billing enabled 2026-11-05).
- AI explanations removed; songs play in-app via the YouTube IFrame API.
- Android 1.1.0 shipped as versionCode 10 (Play had used up to at least 3), signed with `dcc-release-key`.
