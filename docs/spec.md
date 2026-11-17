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
| 2 | Notes: "my notes" on each class card + a free notebook, private to each student | done 2026-11-17 (PR #3) |
| 3 | Chat identity: signed-in posts carry the account; edit/delete own messages; admins moderate by role (guests can still post) | specced below |
| 4 | Admin screen: student list (name, email, joined) and grant/remove admin by email | not specced |
| 5 | Android release: native Google sign-in in the Capacitor app, new signed bundle for Play | not specced |

---

## Slice 3 - Chat identity

### What it does

- **Signed-in, verified students** post under their account name: the composer
  shows "Posting as {name}", and "change" opens the account sheet where the name
  is edited. Their messages carry a small member mark.
- **Renaming** in the account sheet also updates the name on their messages
  from this quarter.
- They can **edit** and **delete** their own messages (and replies) any time
  this quarter. Edited messages show "(edited)".
- **Deleting a message that has replies** keeps the replies: the message shows
  "This message was deleted". Without replies it's removed completely.
- **Admin accounts** (the admin role from slice 1) can edit or delete any
  message and get an "Admin" tag on their own posts. Admin deletes of a message
  with replies also show "This message was deleted".
- **Guests** (and unverified accounts) post exactly as today: type a name, no
  edit/delete. "Studio Admin" stays reserved.
- **The calculator passcode no longer controls chat**; it still unlocks the
  calculator. The `chat-moderate` function and the passcode token in the chat
  go away.
- **Deleting an account** keeps its messages but shows them as
  "Former student" (no member mark, no longer editable by anyone but admins).

### Confirmed decisions

| Decision | Choice | Why |
|---|---|---|
| Post name for members | The account display name (edited in the account sheet); enforced by the rules against the profile | User choice; nobody can post under another member's name |
| Renaming | Updates the name on their messages this quarter | Keeps the chat consistent with the account name |
| Moderation | Admin role only, checked by Firestore rules (`request.auth.token.admin`) | User choice; slice 1 rule: never trust the UI badge |
| Calculator passcode | Unchanged for the calculator; no longer moderates chat; `chat-moderate` removed | User choice |
| Editing | Own messages, any time this quarter, marked "(edited)" | User choice |
| Delete with replies | Soft delete ("This message was deleted"), replies stay; hard delete when there are no replies | User choice |
| Who counts as a member | Signed in with a verified email (Google counts) | Slice 1 decision |
| Guests | Unchanged: any name, no edit/delete, "Studio Admin" reserved | Decision 2026-11-17 |
| Deleted accounts | Messages relabelled "Former student", member link removed, by `/api/delete-account` | Decision 2026-11-17 |
| Data | `chatMessages` gains `uid` (members only), `role` ('member' / 'admin'), `editedAt`, `deleted`; existing guest messages untouched | Minimal change to the live collection |
| Out of scope | Reactions, mentions, notifications, reporting, chat on Android (slice 5) | Keep the slice small |

### Done means

| # | Criterion | Checked by |
|---|---|---|
| 1 | A guest posts and replies exactly as before; no edit/delete controls on any message | browser preview |
| 2 | A verified member's composer shows "Posting as {account name}"; "change" opens the account sheet; the post appears with a member mark | browser preview against the emulators |
| 3 | Rules: a member can't post under a name other than their profile name, can't set another uid, can't claim the admin role; guests can't set uid/role | rules tests |
| 4 | A member can edit their own message; it shows "(edited)"; they can't edit or delete anyone else's | browser preview + rules tests |
| 5 | A member deletes their own message: without replies it disappears; with replies it shows "This message was deleted" and the replies stay | browser preview + emulator data check |
| 6 | Renaming in the account sheet updates the name on that member's messages this quarter | browser preview + emulator data check |
| 7 | An admin account sees edit/delete on every message and an Admin tag on its own posts; a non-admin can't moderate (rules refuse) | browser preview + rules tests |
| 8 | Unlocking the calculator passcode no longer shows chat moderation; the calculator still works | browser preview |
| 9 | Deleting an account relabels its messages "Former student" and removes the member link | delete-account test against the emulator |
| 10 | Existing guest messages already in the live chat still display and can't be edited by non-admins | emulator with seeded old-format messages + rules tests |
| 11 | `npm run build` passes; main bundle under 320 kB | build output |
| 12 | Works at 375px and desktop; 44px tap targets; floating composer still rises from the nav on mobile | browser preview |

### Reference to match

The current chat (`components/AnnouncementsView.tsx`, `services/chatService.ts`)
and slice 1-2's account sheet patterns.

### Second check

Fresh-context reviewer subagent with this spec, the criteria and the diff.

### Open questions

- None.

---

## Slice 2 - Notes

### What it does

- Each class card gets a small **My notes** button. Signed out, it opens the
  sign-in sheet; signed in but unverified, it opens the "Check your email"
  step; otherwise it opens a sheet titled with the class name.
- The class sheet shows **this week's note** for that class: a dated entry
  tagged with the week and the pattern on the card ("Week of Nov 17 · Sugar
  Push w/ Spring"). Below it, the student's earlier weekly entries for that
  class, newest first. Tapping one opens it to read, edit or delete.
- Notes save with a **Save** button. Closing with unsaved changes asks
  "Discard your changes?". Saving works offline: the note is kept on the
  device and syncs when the connection is back, and the sheet says so.
- The account sheet's "coming next" panel becomes **My notes**: class notes
  grouped by class (newest first), then free notes, plus **New note** for a
  free note with an optional title. Opening a note there uses the same
  editor.
- Notes are private: only their owner can read or change them, and deleting
  the account deletes them (already built in slice 1).

### Confirmed decisions

| Decision | Choice | Why |
|---|---|---|
| Class note shape | One dated entry per class per week, tagged with that week's pattern | User choice: builds a history per class |
| Week | Weeks start Monday; reopening a class in the same week reopens that week's entry | One entry per class per week, no duplicates |
| Class identity | Keyed by the class name (the sheet has no stable class id); the note stores the class name and pattern as written that week | Notes survive the weekly sheet edits; a renamed class starts a new group, old notes stay readable |
| Notebook home | Inside the account sheet; nav stays at 3 tabs | User choice |
| Saving | Explicit Save button, with a discard-changes prompt | User choice |
| Offline | Firestore offline cache; saves made offline sync later | User choice: studios often have bad signal |
| Who can use it | Signed in with a verified email (Google counts as verified), enforced by Firestore rules | Slice 1 decision |
| Data | `users/{uid}/notes/{noteId}`: kind (class/free), classKey, className, pattern, weekOf, title, body, createdAt, updatedAt | Lives under the profile, so account deletion removes it |
| Limits | Body up to 10,000 characters, title up to 80 | Generous for class notes; keeps documents small |
| Out of scope | Search, sharing, formatting/rich text, photos, admins reading student notes, Android (slice 5) | Keep the slice small |

### Done means

| # | Criterion | Checked by |
|---|---|---|
| 1 | Signed out, class cards look as before apart from a My notes button; tapping it opens the sign-in sheet | browser preview |
| 2 | An unverified email account tapping My notes gets the "Check your email" step, and the rules reject its note writes | browser preview + rules test |
| 3 | A verified student can write and Save this week's note on a class; it shows the week and the card's pattern, and survives reload | browser preview against the emulators |
| 4 | Reopening the same class in the same week reopens that entry (no duplicate); an entry from an earlier week shows under "Earlier notes" | emulator (seeded earlier-week note) + browser |
| 5 | Editing an earlier entry and saving updates it; deleting it (after confirming) removes it | browser preview |
| 6 | Closing with unsaved changes asks "Discard your changes?"; Keep editing keeps the text | browser preview |
| 7 | Account sheet > My notes lists class notes grouped by class and free notes; New note creates a free note with an optional title | browser preview |
| 8 | Offline: with the network cut, Save shows "Saved on this device, will sync"; after reconnecting it reaches the database | browser preview (offline emulation) + emulator data check |
| 9 | Rules: only the owner can read/write their notes; fields and sizes are validated; another student and guests are refused | rules tests against the emulator |
| 10 | Deleting the account removes all notes (regression of slice 1) | delete-account test |
| 11 | `npm run build` passes; the main bundle stays under 320 kB (notes code loads lazily) | build output |
| 12 | Works at 375px and desktop; tap targets 44px; the class cards stay equal height | browser preview |

### Result (2026-11-17)

All criteria met.
- 1-8, 12: browser preview against the emulators (offline via Firestore's network toggle); Lamarr confirmed notes on the deploy preview against the live project.
- 9: 12 notes-rules tests (29 tests total) pass; live rules spot-checked (notes 403 signed out, chat 200).
- 10: covered by the slice 1 delete-account test (notes subcollection).
- 11: main bundle 301 kB; notes code is a 13 kB lazy chunk.
- Second check: the fresh-context reviewer found two data-loss paths (offline re-create dropped on sync; editor remount wiping typed text) plus smaller issues; all fixed and re-tested in the browser. While testing, "Keep editing" losing text and discarded text returning on reopen were also found and fixed.

### Reference to match

Slice 1's account sheet (`components/auth/AccountSheet.tsx`) and the bottom
sheet pattern; class cards in `components/ClassesView.tsx`.

### Second check

Fresh-context reviewer subagent with this spec, the criteria and the diff.

### Open questions

- None. (Week starts Monday and class-name keys are proposed above; change
  them at approval if you prefer otherwise.)

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
