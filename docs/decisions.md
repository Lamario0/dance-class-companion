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

## Earlier (redesign and chat, Nov 2026)

- Chat stored in Firestore `chatMessages`, current quarter only, deleted by a TTL policy on `expireAt` (Blaze billing enabled 2026-11-05).
- AI explanations removed; songs play in-app via the YouTube IFrame API.
- Android 1.1.0 shipped as versionCode 10 (Play had used up to at least 3), signed with `dcc-release-key`.
