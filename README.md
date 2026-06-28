# Lectern

**From call for papers to certified credit.**

Lectern is a working web app for event call-for-papers (CFP) and speaker/session
management for **continuing-education events** — built to go past where Sessionize
stops. Sessionize selects talks and builds a schedule. Lectern owns the whole
lifecycle through to **CE credit-hour tracking and certificate issuance**, and
becomes the organizer's system of record.

Beachhead vertical: **K-12 and higher-education professional development**, where
accessibility procurement pressure and credit-hour needs both peak.

> This repository is **Run 1**: a friction audit and a deep, working app. The
> buildable spec and the commercial case come in Run 2.

## Deliverables

| | |
|---|---|
| **Friction audit** | [`FRICTION-AUDIT.md`](./FRICTION-AUDIT.md) — 5–7 concrete Sessionize friction points and where it leaves off. |
| **The app** | [`app/`](./app) — Vite + React + TypeScript, fully client-side, real state, believable seed data. |

## Run it

```bash
cd app
npm install
npm run dev      # http://localhost:5173
# or
npm run build && npm run preview
```

No backend. State lives in the browser (`localStorage`) and seeds itself with a
sample organization, event, speakers, submissions, and roster on first load. The
Accessibility menu has a **Reset** that restores fresh demo data.

## The lifecycle spine (works end to end)

1. **Speaker submits** — `/submit`. The neurodiverse-friendly showcase: five short
   chunked steps, real autosave + resume, a reusable speaker profile (no
   re-entry), a calm progress indicator (no countdown), full keyboard + screen-
   reader support, mobile-first.
2. **AI first-pass review** — `/organizer/review`. Auto-summary, fit + quality
   scores, duplicate / off-topic / missing-objective flags, and a suggested
   decision the organizer accepts or overrides.
3. **Schedule** — `/organizer/agenda`. Place accepted sessions into rooms and
   times with fully keyboard-operable controls.
4. **Register & check in** — `/organizer/roster`. Lectern owns the attendee roster
   because it is the credit-bearing record. Simulate per-session door check-in.
5. **CE credit accrues** — credit-hour rules are concrete for the K-12 / higher-ed
   beachhead (clock hours, 90% attendance, evaluation required, CEU conversion).
6. **Certificate issued** — `/organizer/credits` → a real, printable, downloadable
   certificate at `/certificate/:id` with name, event, sessions, hours, date, and
   the accredited issuing-body line.
7. **Dashboard & history** — `/organizer` and `/organizer/history`. Live metrics,
   total credits issued, and year-over-year continuity across past events.

Secondary flows are functional too: agenda builder, roster/check-in, dashboard
analytics, multi-event history, the public event page (`/event`), and the
always-available accessibility preferences control. External integrations
(Eventbrite, Stripe, Canvas LMS, Google Calendar, Mailchimp, HubSpot) are mocked
hooks, never live.

## Accessibility (structural, not a coat of paint)

Targets **WCAG 2.2 AA**; aligned to **ADA** and **Section 508**. Full keyboard
operability with visible focus on every control, semantic HTML + ARIA, labeled
forms with tied instructions and clear errors, resizable text, reflow, and
`prefers-reduced-motion` respected. User-controllable, persistent preferences —
reduced motion, high contrast, text size, density, and focus mode — are reachable
from anywhere via the **Accessibility** button in the top bar.

## Code map

```
app/src/
  data/types.ts        Clean, named domain model (documented in Run 2)
  data/seed.ts         Believable sample org/event/speakers/submissions/roster
  lib/ai.ts            AI first-pass review (deterministic, explainable stand-in)
  lib/credits.ts       Credit engine — attendance → clock hours → certificate
  store/AppStore.tsx   Single source of truth + localStorage persistence + actions
  store/Preferences.tsx Accessibility preferences (data-attributes on <html>)
  components/          Design system, app shell, nav, a11y toolbar, shared UI
  pages/               Spine + secondary flow screens
  index.css            Design tokens + accessibility theming (contrast/scale/motion)
```

The data structures in `data/types.ts` are deliberately explicit because Run 2
documents them as the buildable spec.
