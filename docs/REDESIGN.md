# Dance Class Companion — Redesign Brief (v2)

Written Oct 31, 2026. Inspiration: three Kole Jain videos — mobile UI fundamentals, "4 UI design hacks to kill boring designs", and "11 micro animations". The distilled rules live in `CLAUDE.md` → *Design principles*; this file applies them to DCC.

## Goal

DCC is used mostly on phones (web + Capacitor Android/iOS). Today it is a desktop layout squeezed onto a phone: a cramped top segmented nav with 10px labels, cards nested inside cards, oversized radii and icon chips that eat space, a `<select>` for videos, and entrance animations that never actually run. The redesign should feel like a **mobile-first app with dance-studio personality** — still dark, still violet/fuchsia, but warmer, roomier and more alive.

**Vibe:** playful-professional. Think a studio's friendly front desk, not a crypto site and not a SaaS dashboard. Personality comes from motion, small doodles and friendly copy — not from more boxes.

## Hard constraints

- Keep every feature and all data flows exactly as they are: `services/*`, `firebase.ts`, `netlify/functions/*`, Firestore rules, Capacitor config, the admin passcode flow (triple-tap logo → `/api/admin-login`), CalculatorView logic, comments logic.
- This is a UI/UX change only. Don't change the Google Sheets schema or `types.ts` shapes (adding UI-only types is fine).
- Work on branch `redesign/v2`. Open a PR to `main`; **do not merge** — Netlify gives a deploy preview and `main` is live for real classes.
- `npm run build` must pass. Keep the bundle lean: prefer CSS / Web Animations API. A small motion dependency is acceptable only if the bottom-sheet drag genuinely needs it.
- Respect `prefers-reduced-motion` everywhere (no movement, keep simple fades).
- Add `env(safe-area-inset-*)` padding so the bottom bar and sheets clear the iOS home indicator / Android gesture bar.

## Bugs to fix along the way

1. `animate-in`, `fade-in`, `zoom-in-95`, `slide-in-from-*` classes are used in 7 places but no animation plugin is installed with Tailwind v4, so they do nothing. Either add `tw-animate-css` (`@import "tw-animate-css";` in `index.css`) or replace them with the new motion tokens below.
2. `MediaView` builds `text-${color}-400` dynamically — Tailwind can't see it, so the song column colors never render. Use a static lookup map.
3. Nav label size is `text-[10px]` on mobile — too small to read or hit.

## 1. Foundations (`index.css`, Tailwind v4 `@theme`)

- **Tokens:** define colors (surface-0/1/2, line, text-hi/mid/lo, brand violet + fuchsia accent, plus the existing sky/emerald/rose accents), radii (sm 10px, md 16px, lg 24px — retire the 2.5rem/3rem radii), spacing and shadows as theme variables. Use them instead of ad-hoc values.
- **Type:** base 16–17px on mobile, never below 12px for any label. Section labels can stay uppercase but use less letter-spacing than today's `tracking-[0.2em]`.
- **Motion tokens:** a springy ease (≈ `cubic-bezier(.34,1.56,.64,1)`) at 300–500ms for pops; a calm ease-out for fades; stagger 40–60ms for lists.
- **Cards:** one level of card only. Inside a card, group with spacing and hairline dividers, not more cards.

## 2. Navigation

- **Mobile (< sm):** floating bottom tab bar — Classes, Media, News. Rounded pill, blurred surface, ≥44px targets, icon + 12px label, active indicator slides between tabs with spring easing. When admin is unlocked, Admin appears as a 4th tab and "Exit admin" moves inside the Admin screen (not the bar).
- **Top header (mobile):** slim — logo (still the secret triple-tap target) + page title, and contextual actions only for the current screen.
- **Desktop (≥ md):** keep a top nav, cleaned up to the same tokens.
- Hide the bottom bar while a bottom sheet is open; animate it out/in.
- Tab switch: content cross-fades with a small slide in the direction of travel. Optional: horizontal swipe between tabs on mobile.

## 3. Classes (home)

- Each class = one card: class name as a strong heading (drop the calendar icon chip and the separate header band), then "This week's pattern" as a list of rows with hairline dividers — no row cards.
- The AI explain button: icon-only stays, but give it an accessible label, a ≥44px hit area, a delayed (~1s) tooltip on desktop hover ("Ask the AI instructor"), and a press-shrink.
- **AI explanation → bottom sheet on mobile** (keep a centered dialog on desktop): background scales down slightly and dims, sheet springs up, swipe-down or tap-outside to dismiss, title = the pattern name, friendly loading state (e.g. animated dancing-feet or music-note dots instead of a spinner). Cache answers as today.
- Instructor notes: a light inline quote under the pattern. **If notes are empty or "No notes for this week", hide the block entirely.**
- Video of the Month: a single hero card below the classes — thumbnail-first with a play button that swaps in the embed on tap (faster than loading the iframe up front), one-line title, small "Video of the month" eyebrow label. No nested frames, no glow halo.
- Cards enter with a short staggered rise + fade on first load.

## 4. Media

- **Tutorials:** replace the `<select>` with a horizontal carousel of thumbnail cards (YouTube thumbnail derived from the video ID) above a single player. Selected card shows a ring. One scroll direction only.
- If there are more than ~6 tutorials, add a search icon in the section header that expands into a filter field (icon slides into the field).
- **Songs:** on mobile, a segmented control — New · Bluesy · Practice — over one vertical list (one thing at a time). On desktop, the three columns are fine. Each row: title, artist, a clear Spotify/YouTube badge, press feedback.
- Empty playlist: small doodle + "No songs here yet — check back after class."

## 5. News

- "One screen, one thing": split into two sub-views with a segmented control at the top — **Updates** and **Chat**.
- Updates: clean list with a compact date badge on the left, color dot for event type; tap to expand details with a smooth height animation. Collapse the "Event key" into a single row of small legend chips (or a tooltip on the dots).
- Chat: messages list with the composer as a sticky input at the bottom (name remembered locally after first post). Posting shows a toast that animates up: "Posting…" → "Posted ✓". On desktop, hovering an avatar pops a small tilted name tag.

## 6. Empty, loading and error states

- Write them as designed screens, not afterthoughts: a small doodle, one friendly sentence, and an action when one makes sense.
- First load: keep "Warming up the dance floor…" style copy with a light skeleton of the class cards instead of a lone spinner.
- Load failure: "Couldn't reach the studio. Check your connection and try again." + Retry button (re-calls `fetchSheetData`).
- No classes this week: "No classes posted this week — see you on the floor soon."
- Add a playful `public/404.html` (static, same tokens inline): dancing-feet doodle, "You've danced off the floor plan", and a big "Back to class" button.

## 7. Personality layer (use sparingly)

- A small set of inline-SVG doodles in one hand-drawn style: music notes, sparkles ("twinkles"), footprints, a swirl. Place a few around the page header on Classes and in empty states; they trail off away from the center and never touch text. If a spot feels cluttered, remove the doodle.
- Doodles pop/rotate in on load and idle-bob slowly (disabled under reduced motion).
- Headline micro-moment on Classes: e.g. "This week's **patterns**" where the bold word gently bounces in once.
- Friendly copy pass across the app: plain words, no jargon. Examples — "Restricted Access" → "Instructor tools", "Please enter the admin passcode…" → "Enter the instructor passcode", "Curated selection for your growth" → drop it.

## 8. Micro-interactions checklist

- Buttons: press = scale 0.96; primary buttons get the hover text-slide-up (two stacked labels in a mask) on desktop.
- Delayed tooltips on every icon-only button (desktop).
- Toasts for post / copy / errors with a loading → success transition.
- Bottom sheet with background zoom-out.
- Active-tab indicator slides between tabs.
- Accordion height animation on announcements.
- Haptics on Capacitor native builds for tab changes and sheet open (optional, only if `@capacitor/haptics` is a trivial add).

## Process

1. Create branch `redesign/v2`.
2. Foundations + the two bugs first, then nav, then Classes, Media, News, states, personality, micro-interactions.
3. After each screen, run the dev server and check it at 375×812 and desktop width; fix overflow, tap-target and contrast issues.
4. `npm run build` must pass.
5. Commit in logical steps, push, and open a PR titled "Redesign v2: mobile-first UI" with a short summary and before/after screenshots (375px) of Classes, Media and News. Don't merge.
