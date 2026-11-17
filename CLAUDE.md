# Dance Class Companion

Student portal for West Coast Swing classes (danceclasscompanion.com): weekly patterns, videos and music, studio news and chat. React 19 + Vite + Tailwind v4, deployed to Netlify from `main`, wrapped with Capacitor for Android (Google Play) and iOS.

## How this repo works

- `App.tsx`, `components/` - the UI; `components/ui/` shared pieces, `components/music/` the YouTube music player
- `services/` - data: Google Sheets content (`dataService`), Firestore chat (`chatService`)
- `firebase.ts`, `firestore.rules`, `firestore.indexes.json` - Firebase app, rules, TTL policy (project `dance-class-companion`)
- `netlify/functions/` - server code: admin passcode login (`verify-admin`), chat moderation (`chat-moderate`)
- `android/`, `ios/` - Capacitor native projects; release signing via gitignored `android/keystore.properties`
- `docs/` - project knowledge (see below); `.claude/` - guardrails and hooks

Run it: `npm run dev` (port 3000; `.env.development.local` points Firestore at the emulator)
Emulators: Firestore on 8080 - start with `JAVA_HOME` set to Java 21 (`C:\Program Files\Eclipse Adoptium\jdk-21*`)
Build: `npm run build` (must pass before pushing)
Android: `npm run build && npx cap sync android`, then `gradlew bundleRelease` with `JAVA_HOME` = Android Studio's `jbr`

## Where knowledge lives

- `docs/spec.md` - the goal, the slices, and what "done" means for the current slice. Read it before starting work.
- `docs/decisions.md` - dated log of confirmed decisions and why. Add to it when a decision is made; don't re-decide what is logged.
- `docs/reference/` - examples the output should match.
- `docs/REDESIGN.md` - the v2 redesign brief (done; still the design reference).

## Task routing

- UI change -> check it in the browser preview at 375px and desktop before calling it done
- Firestore rules change -> run the rules checks against the emulator before deploying
- Android release -> bump `versionCode` above the highest used (last: 11, 1.2.0), then build the signed bundle; install on a phone with `adb install -r` (Play's app-signing key is the same `dcc-release-key`)

Skill candidates (repeated work with no skill yet):
- Android release (sync, bump version, build + verify signed AAB/APK)
- Firestore rules check against the emulator

## Working rules

- `main` auto-deploys to production and is used for live classes: work on a branch, open a PR, check the deploy preview.
- Before building anything multi-step, state the verification plan: which "done means" lines apply and how each will be checked.
- Work one slice at a time. Stop at the end of a slice and show the result before starting the next.
- Report each criterion with its evidence. If one cannot be met, say so; don't reword it to fit.
- New assumptions go to the user for confirmation, then into `docs/decisions.md`.
- The calculator (triple-tap passcode, dance-party attendance) is separate: don't change it as part of accounts work.

## Guardrails

**Always do** (no need to ask):
- Run `npm run build` after changes
- Check the page at phone width after a layout change
- Test auth and data changes against the local emulators, not the live project

**Ask first** and **never do** are enforced by `.claude/hooks/guard.mjs` from the rules in `.claude/guardrails.json`. If the guard blocks or asks, that is a rule the user set: tell them, and don't route around it with another tool.

## Design principles

Most users are on phones. Apply these to every UI change.

**Mobile layout**
- Bottom tab bar, 3–4 tabs (5 max), tap targets ≥44px. Header actions are contextual to the screen.
- Don't shrink type or spacing to fit more in; mobile type is desktop-sized or larger (base 16–17px). Pick the one thing each screen is for.
- Each section scrolls in one direction: a vertical stack or a horizontal carousel, never a 2D grid.
- Build from cards, text, images and inputs. Never nest cards in cards; group with spacing instead.
- One screen does one thing. New content gets its own view; use bottom sheets to keep context.
- Gestures: swipe-down dismisses sheets, the background zooms out under a sheet, long-press is the mobile right-click. Actions appear when relevant and animate in/out.
- Design empty states (first run, no results, errors) with a doodle, a friendly sentence and an action.

**Avoid sterile "AI mush"**
- Small contextual doodles and sparkles around the core message, trailing off from center, never crowding text. Remove decoration that tips into clutter.
- Motion with personality: springy pops, gentle idle movement, animated key words. Always honor `prefers-reduced-motion`.
- Friendly, plain-language copy. Fun 404 and error pages.

**Micro-interactions**
- Press-shrink on buttons, delayed (~1s) tooltips on icon-only buttons, toasts with loading → success states, sliding active indicators, smooth accordions, expanding search icons.
- Use springy easing (≈ `cubic-bezier(.34,1.56,.64,1)`, 300–500ms) for pops; calm ease-out for fades.
