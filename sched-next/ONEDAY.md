# ONE-DAY BUILD: The Run Sheet

Goal for today: Dana's demo path, real end to end, nothing else. Roughly 9 focused hours. Claude Code reads CLAUDE.md automatically; this file is the order of operations and the pre-made cuts so no product decisions happen mid-build.

## Today's Cuts (Decided, Not Debatable Mid-Build)

SQLite (Postgres-compatible schema). No auth, seeded user switcher only. No ICS. No embeds. No OpenAPI docs page. No QR. Certificates only if ahead at Block 6. One styling pass at the end. These come back in the full build; today they are dead.

## Rules of Engagement

- Commit at the end of every block. A block that breaks gets rolled back, never debugged past its timebox.
- If a block overruns, cut inside it and move forward. Never steal time from a later block; the demo ends on Block 6 and Block 6 must happen.
- You are the product manager today, never the engineer. If Claude Code asks a product question, the answer is in CLAUDE.md or EVIDENCE.md; point it there.

## Block 1 (~90 min): Skeleton and Seed

Prompt: "Read CLAUDE.md and this file. Scaffold Next.js App Router + TypeScript + Prisma with SQLite. Implement the full Stage 0 schema from SPEC.md. Write the seed: Dana's 2-day inservice (~40 sessions, 1,200 people, Act 48 credit type, quarter-hour nearest rounding) and the stress event (600 sessions, 1,500 people). Add `npm run demo:reset` and a top-bar user switcher (Dana / org owner / one attendee). No auth."

Exit: reset works, switcher works, both events queryable.

## Block 2 (~90 min): Schedule

Prompt: "Build the schedule spine: event list, schedule grid with track/time filters, session detail, attendee personal agenda. Keyboard navigable. Then open the stress event and make scrolling and filtering instant."

Exit: stress event scrolls without jank. If polish is eating time, stop; Block 8 handles looks.

## Block 3 (~75 min): Roster Check-In and the Ledger

Prompt: "Roster mode check-in: admin opens a session, clicks people off the roster, Attendance rows written. Attendance triggers append-only CreditRecord entries per SessionCredit using the CreditType rounding policy. Corrections are offsetting entries with a reason. No update or delete paths on the ledger, enforce in the data layer."

Exit: check 20 people in, ledger rows appear, a correction offsets cleanly.

## Block 4 (~45 min): Rounding Tests

Prompt: "Unit tests for credit math only: quarter-hour increments with floor, nearest, ceiling across 15, 50, 60, 90-minute sessions. Add a small settings screen showing each CreditType's policy in plain language."

Exit: tests green. Do not skip this block to save time; it is the credibility anchor of the entire artifact.

## Block 5 (~60 min): Transcript and Act 48 Export

Prompt: "Person transcript page: all credits across events and years, filter by year and type, print stylesheet styled like an official document. Org compliance view with CSV export shaped like an Act 48/PERMS upload (mock the column format, note it as mocked)."

Exit: Dana's transcript prints clean; export opens correctly in a spreadsheet.

## Block 6 (~75 min): MCP Server

Prompt: "Read-only MCP server wrapping the existing API routes, no logic of its own. Tools: list_events, get_schedule, get_person_transcript, get_compliance_report, find_people_missing_credits (people below a credit-hour threshold for a given credit type and date range). Give me the config to connect it to Claude."

Exit: Claude, connected, correctly answers "who still needs two more Act 48 hours" against seed data. This is the last screenshot of the day.

## Block 7 (~30 min, only if ahead): Certificates

Print-CSS completion certificate per person per event with a self-serve download link on the attendee view. Skip without guilt.

## Block 8 (~60 min): One Styling Pass and the Story

One pass over only the screens in the demo path, per the Aesthetic Direction in CLAUDE.md. Then write DEMO.md as Dana's 10-minute story and record a screen capture while everything works. The recording is insurance; live demos break and movies don't.

## What Tonight's Artifact Is and Isn't

It is enough to test your own conviction and enough to show Tom one on one. It is not enough for a room with Marvin and Tony in it; that requires the Stage 4 honesty package and the socialization sequence in EVIDENCE.md. A one-day build shown too widely too fast reads as an ambush; the same build shown to one ally reads as initiative.
