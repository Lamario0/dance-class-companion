# Dance Class Companion

React 19 + Vite + Tailwind v4 web app (danceclasscompanion.com), deployed to Netlify from `main` and wrapped with Capacitor for Android/iOS. Content comes from Google Sheets (`services/`), songs play in-app through the YouTube IFrame API (`components/music/`), admin login through `netlify/functions/verify-admin.mts`.

- `main` auto-deploys to production and is used for live classes: do UI work on a branch and open a PR.
- Run `npm run build` before pushing.
- The active redesign plan is `docs/REDESIGN.md`.

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
