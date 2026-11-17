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
