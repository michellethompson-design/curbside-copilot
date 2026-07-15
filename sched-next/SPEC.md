# SPEC: Staged Build Plan

Each stage is one to three Claude Code sessions. Do not start a stage until the prior stage demos clean. Every stage ends with: (a) something clickable, (b) a curl example against the API, (c) one line added to DEMO.md describing what it proves.

## The Demo Persona

Dana, PD coordinator for a Pennsylvania school district. She runs the two-day August inservice for ~1,200 educators and must document Act 48 hours for state reporting (PERMS). Today that means the event tool, a wall of sign-in sheets, and a spreadsheet she reconciles by hand for two weeks. Every stage exit test is a scene in Dana's story, and every ambiguous product call gets resolved by asking what Dana needs.

## Stage 0: Skeleton and Data Model

Scaffold the app. Define the schema that everything else hangs on:

- `Organization` (the unit; owns everything below)
- `Person` (belongs to org; may be attendee, speaker, admin; one identity across events and years)
- `Role` (four levels, scoped: org owner, org admin, event admin, attendee)
- `Event` (belongs to org; dates, venue, status)
- `Session` (belongs to event; time, room, description, speakers, capacity)
- `CreditType` (org-defined: PD hours, CEUs, contact hours, clock hours; unit, plus an explicit rounding policy: increment [e.g., quarter hour] and mode [floor, nearest, ceiling])
- `SessionCredit` (session offers N units of a credit type)
- `Attendance` (person x session; verification method enum: roster, self, qr; timestamp)
- `CreditRecord` (the ledger: append-only, no updates or deletes; corrections are offsetting entries with a reason field)

Seed script, two events under one district org:

1. **Dana's inservice**: 2 days, ~40 sessions, ~1,200 people, Act 48 hours configured. The story event.
2. **Stress event**: a mock statewide conference, 600+ sessions, 1,500 people. Exists purely so every list, filter, and schedule view is demonstrably instant at the scale the docs claim. Never demo a performance promise the seed can't prove.

Tooling: `npm run demo:reset` restores pristine seed state between run-throughs, and a demo user switcher (one-click impersonation of Dana, an attendee, an org owner) so the walkthrough never burns time on login churn.

Exit test: `GET /api/orgs/:id/events` returns both events; reset and switcher work.

## Stage 1: The Schedule Spine

The thing Sched is loved for, done fast and clean:

- Organizer: create/edit event, add sessions (with bulk paste/import; imports are idempotent, re-running one never duplicates venues or sessions).
- Attendee: public schedule page, filter by track/time, add sessions to personal agenda. Fully keyboard navigable.
- Personal agenda exports to calendar (ICS feed with stable per-session UIDs so updates modify entries instead of duplicating; this is the legacy calendar-sync complaint fixed on camera).

Exit test: build a personal agenda in the browser, subscribe to its ICS URL, see it in a real calendar app, change a session time, watch the calendar update without duplicating. Then open the stress event and scroll.

## Stage 2: The Credit Ledger (The Differentiator)

This is the stage the whole challenge rests on. Legacy Sched cannot demo any of it well.

- Check-in writes `Attendance`. **Roster mode is the core path**: an admin clicks people off a session roster, built for a gym with bad wifi. QR self-check-in is stretch, not core.
- Attendance plus `SessionCredit` rules issue ledger entries automatically, applying the CreditType's rounding policy. The policy is visible in org settings (showing the rule is itself a feature legacy lacks).
- **Credit math gets real unit tests.** A visible test table covers the rounding cases (e.g., 50 minutes at quarter-hour increments: floor 0.75, nearest 0.75, ceiling 1.0). One wrong transcript number in a live demo is unrecoverable; this is the only part of the prototype that earns automated tests.
- Person-level transcript: every credit earned across all events and years, filterable by year and credit type, styled like an official document, printable.
- Org-level compliance export: audit-ready CSV/PDF of who earned what. **Include one registry-shaped export**, an Act 48/PERMS-format CSV, so Dana's scene ends with "and this uploads to the state." A mocked format is fine; the point is that the export matches what she reports, so this is fewer systems rather than another one.
- Completion certificates per person per event, with **self-serve re-download** (people lose certificates constantly and email staff for reissues; this tiny feature buys disproportionate love from association customers).
- Concurrency rule, explicit: a person cannot hold verified attendance in two overlapping sessions; retro check-in is allowed with the actor recorded.

Exit test: check 20 people into sessions via roster mode, pull Dana's multi-year transcript, run the Act 48 export, re-download a certificate as an attendee, show the rounding test table green.

## Stage 3: Modularity Proof

- Publish the OpenAPI spec at `/api/docs` with a browsable UI.
- Embeddable schedule widget (one script tag) rendering from the public API.
- API keys per org with scoped permissions, demonstrating the integration pattern (the ACTE/iMIS AMS conversation showed integrations must be a reusable pattern, never bespoke).
- **Stretch: certificate verification URL.** Public endpoint where anyone pastes a certificate ID and sees validity, hash-backed. Trivial build, big trust signal, gestures at open credential standards without building them.
- **Committed: MCP server over the API.** Built last in the stage, only after the REST API and keys work, because it must be a thin wrapper over the same endpoints and the same scoped API keys, never a parallel surface. Read-only tool set for v1: `list_events`, `get_schedule`, `get_person_transcript`, `get_compliance_report`, `find_people_missing_credits`. No destructive tools in v1. The demo beat this enables: "Claude, who still needs two more Act 48 hours before the June deadline," answered live against the seeded district. This is the modularity claim made visceral, and it lands with extra weight because Sched's own AI rollout is Michelle's project.

Exit test: a plain HTML page outside the app embeds the live schedule; a curl with an API key pulls a transcript; Claude connected to the MCP server answers the missing-credits question correctly against seed data.

## Stage 4: The Challenge Package

Not code. The materials that make this a fair fight when it eventually surfaces:

- `DEMO.md` finalized as a 10-minute walkthrough script told as Dana's story: open on the NPS trend, walk each fixed complaint live, show the transcript and the Act 48 export, and close on the MCP moment: Claude answering the missing-credits question against the live district. Last impressions win; the ending is the modularity thesis performing itself.
- `ARGUMENT.md` mapping what was built to the selection-criteria question: the official plan selects rebuild modules on engineering risk; this selects on retention impact, and here is the working result. Include the competitive positioning line and the pricing/expansion hypotheses from EVIDENCE.md, clearly labeled as hypotheses.
- **Win conditions, written as a ladder:**
  1. *Primary:* the credit/learning core is added to the rebuild surface as a module with a proper PRD, and retention impact becomes an explicit selection criterion.
  2. *Secondary:* the selection-criteria question (engineering risk vs retention impact) gets decided openly instead of defaulting.
  3. *Floor:* leadership agrees to the pilot metric in EVIDENCE.md so the thesis gets tested with data even if the prototype changes nothing.
  "Adopt my prototype" is not on the ladder and never becomes the ask.
- Honest limits section: what a demo skips (scale, migration, edge cases, the long tail the port estimate covers). The credibility of the challenge depends on conceding this out loud.

## Working Notes

- Timebox ruthlessly. If a stage drags past three sessions, cut scope inside it rather than extending. Stretch items die first, in this order: verification URL, QR check-in. MCP is committed and does not die; if Stage 3 is in trouble, shrink the MCP tool set to `get_compliance_report` and `find_people_missing_credits` before cutting it entirely, because the demo ends on it.
- UI polish matters only on the screens in the demo script. Everything else can be plain, but nothing anywhere breaks keyboard navigation.
- Keep a running `DECISIONS.md`: one line per product call made and why. This becomes ammunition later.
