# Dance Class Companion accounts - spec

## Goal

This exists so that students can keep their own class notes across devices and
own their chat identity, and so the admin can manage who's an admin; the first
version is done when a student can sign up with email or Google on
danceclasscompanion.com, write notes on a class and in a free notebook, edit or
delete their own chat messages, and the admin can see students and grant admin
from an admin screen.

- **Used by:** the public (class students), plus the admin (Lamarr) and anyone
  he makes an admin.
- **First version is done when:** all five slices below are live on
  danceclasscompanion.com (the website; the Android release follows).

## Out of scope

- Class attendance and QR check-in (next project, after this one).
- The calculator / dance-party attendance. It keeps its triple-tap passcode and
  is not touched.
- Apple sign-in (revisit when the Apple Developer account and iOS app are real).
- An "instructor" role. Roles are only **student** and **admin**.
- Email-link (passwordless) sign-in, profile photos, social features.

## Slices

Only the current slice is specced. Later ones are specced when reached.

| # | Slice | State |
|---|---|---|
| 1 | Accounts on the website: sign up / sign in (email + password, Google), name, sign out, delete account; admin role on Lamarr's account | done 2026-11-17 (PR #2) |
| 2 | Notes: "my notes" on each class card + a free notebook, private to each student | not specced |
| 3 | Chat identity: signed-in posts carry the account; edit/delete own messages; admins moderate by role (guests can still post) | not specced |
| 4 | Admin screen: student list (name, email, joined) and grant/remove admin by email | not specced |
| 5 | Android release: native Google sign-in in the Capacitor app, new signed bundle for Play | not specced |

---

## Slice 1 - Accounts on the website

### What it does

- Anyone can keep using Classes, Media and News without an account, exactly as
  today.
- A small account button in the header opens a sheet. Signed out, it offers
  **Continue with Google** and **email + password** (sign up, sign in, "forgot
  password" email). A new account asks for a display name.
- Email sign-ups get a verification email. Until they click it, the sheet shows
  "Check your email" with a **resend** button, and the account is treated as
  unverified (slices 2-3 will keep Notes and chat edit/delete locked until
  then). Google accounts count as verified.
- Signed in, the sheet shows the name and email, lets the student change their
  name, sign out, and **delete my account** (with a confirm step).
- Deleting an account removes the login and profile (and, once slice 2 exists,
  their notes). Chat messages stay; slice 3 relabels them "Former student".
- Lamarr's account has the **admin** role, set once by a script. It is visible
  in the sheet ("Admin") but grants nothing new until slices 3-4. The
  calculator's triple-tap passcode is unchanged.

### Confirmed decisions

Every row was confirmed by the user, not assumed.

| Decision | Choice | Why |
|---|---|---|
| Stack | Existing React 19 + Vite + Tailwind 4 app; Firebase Auth + Firestore (already set up, billing on) | Matches the project and the user's defaults |
| Sign-in methods | Email + password (with password reset) and Google. No Apple, no email link | User choice; Apple needs a paid developer account |
| Guest access | Sign-in optional; the app works signed out | User choice |
| Roles | Student (default) and admin; admin is a Firebase custom claim `admin: true` | User choice; claims are trusted by Firestore rules and work in the app |
| First admin | Lamarr's account, set by a one-time script using the service account | User choice: "my account and any I choose" (granting others is slice 4) |
| Calculator | Untouched; keeps its passcode | User choice |
| Profile data | `users/{uid}`: displayName, createdAt. Email comes from Auth, never shown to other students | Least data needed |
| Email verification | Required: email accounts can't use Notes or chat edit/delete until verified; Google accounts are already verified | User choice |
| Admin account | lamariow@gmail.com | User choice |
| Delete account | Removes login + profile + notes; chat stays, relabelled "Former student" in slice 3 | User choice; Play requires in-app deletion |
| Server code | Netlify functions with the Admin SDK (existing pattern, key already in Netlify) | Consistent with `chat-moderate.mts` |
| Hosting / release | Website first (branch -> PR -> deploy preview -> main), Android in slice 5 | User choice |
| Development | Firebase Auth + Firestore emulators locally (Java 21 for the emulator) | User's defaults; keeps tests off the live project |

### Done means

Each line is pass/fail and names its check.

| # | Criterion | Checked by |
|---|---|---|
| 1 | Signed out, Classes, Media and News look and behave as before, and nothing asks for sign-in | browser preview (phone + desktop) |
| 2 | A new user can sign up with email + password and a display name; reloading keeps them signed in | browser preview against the Auth emulator |
| 3 | "Continue with Google" signs a user in and creates their profile on first sign-in | browser preview against the Auth emulator (emulated Google); then the deploy preview with a real Google account (user looks) |
| 4 | Wrong password and "email already in use" show friendly messages, not raw Firebase codes | browser preview |
| 5 | "Forgot password" sends a reset email | Auth emulator log; real email on the deploy preview (user looks) |
| 5b | Email sign-up sends a verification email; the sheet shows "Check your email" + resend until verified, then shows the account normally (checked on reopen/refresh) | Auth emulator (verify link from its log); real email on the deploy preview (user looks) |
| 6 | Changing the display name updates the sheet and survives reload | browser preview |
| 7 | Sign out returns to the signed-out sheet | browser preview |
| 8 | Delete account (after confirming) removes the Auth user and `users/{uid}`; signing in again with those details fails | emulator: Auth + Firestore state checked by script |
| 9 | Firestore rules: a user can read/write only their own `users/{uid}`; nobody can set roles from the browser; other students cannot read it | rules test script against the emulator |
| 10 | Lamarr's account shows "Admin" after the one-time script; other accounts don't | emulator, then deploy preview (user looks) |
| 11 | `npm run build` passes and the main bundle stays under 320 kB (Auth loads lazily) | build output |
| 12 | Works on a 375px-wide screen with 44px tap targets and the existing design tokens | browser preview at 375px |

### Result (2026-11-17)

All criteria met.
- 1, 2, 4, 6, 7, 12: browser preview against the emulators (375px and desktop).
- 3, 5, 5b: emulator, then confirmed by Lamarr on the deploy preview against the live project (real Google sign-in, real verification and reset emails).
- 8: emulator test + UI run, then a real delete on the deploy preview.
- 9: 15 rules tests (17 tests total) pass; live rules spot-checked (profiles 403 signed out, chat 200).
- 10: emulator via `set-admin.mjs`; lamariow@gmail.com made admin on the live project, badge confirmed.
- 11: main bundle 298 kB.
- Second check: fresh-context reviewer found a profile-creation race, stale watcher updates, delete error handling, an emulator-mode risk and a stuck loading state; all fixed and re-tested.
- Found on the deploy preview: firebase-admin 14 crashed Netlify functions (jwks-rsa 4 -> ESM-only jose 6); pinned firebase-admin 13.

### Reference to match

The app's own redesign: `docs/REDESIGN.md`, `CLAUDE.md` design principles, and
the existing bottom sheet (`components/ui/BottomSheet.tsx`, used for the
instructor passcode). The account sheet should look like it belongs.

### Second check

A fresh-context reviewer subagent given only this spec, the criteria and the
diff (no Codex plugin in this session). Same model, independent context.

### Open questions

- Google sign-in must be enabled in the Firebase console, and the deploy-preview
  domain added to Auth's authorized domains. These change the live project; ask
  first. (user approves)
