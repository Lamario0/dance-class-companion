# Decisions

Dated log of confirmed decisions. Don't re-decide what is logged here.

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

## 2026-11-17 - Slice 2 build notes

- Two devices, same class + week: when the server is reachable, a save adds to the other device's text instead of replacing it (both the first save and a save after the note changed underneath). Known limit: if a device was offline and its cache never saw the other note, its sync replaces that note's text (accepted by the rules rather than silently dropped).
- Late sync refusals (after "Saved on this device") show a toast. In private browsing (no IndexedDB) the wording says to keep the page open instead of "will sync".
- Free notes can't take a class-note id; class names with no Latin letters get a hashed key.
- Known, accepted: devices in different time zones may disagree on the week around Monday midnight; offline chat posts queued past the end of a quarter are refused by the TTL/quarter rules.

## Earlier (redesign and chat, Nov 2026)

- Chat stored in Firestore `chatMessages`, current quarter only, deleted by a TTL policy on `expireAt` (Blaze billing enabled 2026-11-05).
- AI explanations removed; songs play in-app via the YouTube IFrame API.
- Android 1.1.0 shipped as versionCode 10 (Play had used up to at least 3), signed with `dcc-release-key`.
