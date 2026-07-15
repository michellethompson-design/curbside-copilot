# Sched Next

Skunkworks prototype. One person (Michelle) building with Claude Code. The goal is a working demo that challenges the current "port everything" rebuild plan by proving a sharper alternative: a PD-first, API-first event platform built around why customers actually keep Sched.

## What Sched Is

Sched is a 14-year-old event management SaaS (~$4.5M ARR, ~30 people, bootstrapped). Core users: K-12 schools, higher ed, and membership associations running conferences, PD days, and continuing education events. Organizers build event schedules with sessions and speakers; attendees browse and build personal agendas. Adjacent modules: CFP (call for papers/session submissions), Schedmin (admin console), embeds, ticketing/registration.

## The Thesis This Prototype Proves

Sched's customers are under severe budget pressure (post-ESSER K-12 cuts). Churn is mostly exogenous: fewer events, smaller budgets. "Events management software" is an easy budget line to cut. "Professional development / continuing education infrastructure" is not, because PD is mandated, tracked, and audited. The survival bet is consolidation into the PD budget line: Sched as the cheapest way to run and document mandatory learning.

Therefore the prototype is not a 1-for-1 clone. It is the schedule product Sched is loved for, wrapped around a CE/PD credit tracking core that the legacy product only gestures at, exposed through a real public API.

## Ratified Foundations (Do Not Relitigate)

These came out of the official rebuild thesis work and hold under any version of the strategy:

- **Organization is the unit**, not the event. Orgs own events, people, and credit records across years.
- **Four-level roles/permissions**: org owner, org admin, event admin, attendee/member. Permissions apply instantly (the legacy product takes minutes to propagate; that is a known rage trigger).
- **API-first.** Every feature ships as an API endpoint before it ships as UI. The web app is a client of the same API any integration would use.
- **The Credit Ledger.** Credit records are an append-only ledger, like an accounting system: no updates, no deletes, corrections as offsetting entries with a reason, transcripts and compliance reports as derived views. The auditor is a user. This is both the cleanest architecture and the sharpest sentence in the eventual pitch.

## Aesthetic Direction

Calm institutional confidence. Dense but legible schedule grid, recognizably Sched in its mental model (tracks, time slots, color coding) so it reads as familiar-but-healed rather than alien. The transcript and certificate screens are styled like official documents because they get printed and handed to principals and accreditors. Restrained palette, real typographic hierarchy, nothing startup-generic.

## Design Rules Derived from Real NPS Verbatims

~255 NPS responses, Feb-Jun 2026. Blended score +12 to +15 and declining (June roughly breakeven). Top complaints are architecture smells. These are hard constraints:

1. Styling and settings never silently revert on save. State is explicit and versioned.
2. Sessions do not randomly log users out. Boring, solid auth (session refresh done right).
3. No UI element ever overlaps another interactive element (the chatbot-over-edit-menu bug scored 1s).
4. Anything sent (messages, emails) is reviewable afterward as real content, never a static image.
5. Bulk operations everywhere there is a list: select all, filter, sort. The legacy CE screen has none.
6. Calendar sync is a first-class API consumer, not a bolted-on afterthought.
7. Defaults never destroy user input (speaker photo auto-fill overwrote correct photos).
8. Fast. CFP-style parsing and list views must feel instant at conference scale (500+ sessions), and the seed data proves it (see stress event in SPEC.md).
9. WCAG 2.1 AA is a hard requirement, never a cleanup pass: keyboard navigable, visible focus states, AA contrast. This ICP procures against accessibility requirements and Sched has personally negotiated VPAT indemnification language; a demonstrably accessible prototype is a differentiator no port delivers.
10. Calendar exports use stable per-session UIDs so updates modify existing calendar entries instead of duplicating them.

## Stack

- TypeScript end to end.
- Next.js (App Router) + React for the web client. Read /mnt/skills/public/frontend-design/SKILL.md before any UI work if available; otherwise aim for restrained, editorial, education-professional design. Not startup-generic.
- Postgres via Prisma. SQLite acceptable for stage 0 local dev if it speeds things up, but schema must be Postgres-compatible.
- REST API with OpenAPI spec generated from code. The spec is a deliverable, it is part of the pitch.
- MCP server as a committed Stage 3 deliverable: a thin, read-only wrapper over the same REST endpoints and scoped API keys. It exists to prove the API pattern, so it must never grow logic of its own.
- Auth: simple email magic link or seeded users for the demo. Do not burn time on production auth.

## Non-Goals

- Feature parity with legacy Sched. Cruft stays dead.
- Data migration. Seed data only (see SEED.md guidance in SPEC.md).
- Billing, payments, production hardening, mobile apps.
- Rebuilding CFP or Schedmin as-is. If a submissions flow appears, it is a thin, modern take.

## How to Work

- Follow SPEC.md stages in order. Every stage ends with something demoable in a browser plus a working curl example against the API.
- Keep the repo boring and readable. Another engineer (Tony, Lowell) may eventually read this to judge the approach, so the code is part of the argument.
- When a product decision is ambiguous, EVIDENCE.md is the tiebreaker: pick whatever best serves the PD/retention thesis and the NPS fix list.
- Small commits with plain-English messages. The commit log should read like a build diary.
