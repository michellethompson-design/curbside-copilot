# DEMO.md — Dana's Ten Minutes

The walkthrough is one story: Dana Whitfield, PD coordinator for Keystone
Valley School District, runs the two-day August inservice for 1,200 educators
and owes the state an Act 48 report. Today that means the event tool, a wall
of sign-in sheets, and two weeks of spreadsheet reconciliation. This demo is
her August without the spreadsheet.

Prep: `npm run demo:reset && npm run dev`, switcher on **Dana Whitfield**.
Every scene below is a URL in the running app; nothing is staged.

## Scene 1 — The schedule people already love (2 min)

*Events → August Inservice 2026.*

Two days, 42 sessions, five tracks — the grid Sched is loved for, filterable
by day, track, time and text, every control keyboard-reachable. Click into a
session: it shows its room, its speaker, and — new — **the credit it carries
and exactly how that number is computed**. 90 minutes, quarter-hour nearest,
1.50 Act 48 hours. No mystery meat.

Then the proof of scale: open **PA Statewide Educators Conference (stress
test)** — 600 sessions, 1,500 people — and scroll and filter. It's instant.
Say it plainly: *the performance claims are made against this event, not
against a ten-session toy.*

## Scene 2 — The gym door (2 min)

*Any breakout session → Open roster check-in.*

Roster mode: one search box, one click per person, built for a gym with bad
wifi. Check a few people in. Each click writes the attendance record **and
appends the credit award to the ledger in the same step** — the badge at the
top says exactly what each check-in is worth.

Now the beat that matters: check someone in by mistake, then undo it. It
demands a reason. The wrong award is not erased — it is **offset by a dated
correction entry**. Nobody edits history in this product; that is the ledger
promise, and it is enforced in the data layer, not by policy.

## Scene 3 — The number the state sees (2.5 min)

*My transcript.*

Dana's own transcript: 2025 inservice, spring PD day, multi-year, filterable
by year and credit type, and printable — styled like the official document it
becomes when it lands on a principal's desk. Point at the red line: last
year's duplicate keynote check-in, corrected in the open with its reason and
date. The total is net of it. *An auditor is a user of this system.*

*Compliance.*

The district view: who earned what, who is short, live from the same ledger.
Then click **Download Act 48 / PERMS CSV** and open it — PPID, name, program,
dates, hours, shaped like the state upload (format mocked for the prototype,
say so out loud). Dana's scene ends with: *"and this uploads to the state —
it's fewer systems, not another one."*

*Credit settings* (30 seconds, in passing): every rounding policy stated in
plain language with a worked table, backed by unit tests. Show the tests are
green if anyone leans in: `npm test`.

## Scene 4 — The attendee's thirty seconds (1 min)

Switch to **Marcus Bell**. My agenda, his sessions, and **his certificate —
self-serve, re-downloadable forever**. The email to staff asking for a reissue
is the feature this deletes.

## Scene 5 — The ending: the API performing itself (2.5 min)

The whole app runs on a REST API; the web pages are just a client of it. The
MCP server (`mcp/README.md`) is a **read-only wrapper over those same
endpoints — five tools, no logic of its own**.

Connect Claude and ask, live:

> **"Who still needs two more Act 48 hours before the June deadline?"**

Claude finds the district, calls `find_people_missing_credits`, and answers
with names and shortfalls from the same ledger the transcript printed from.
(`npx tsx scripts/verify-mcp.ts` runs this exact sequence and cross-checks the
numbers, if you want the rehearsal proof.)

Last line, verbatim: *"That answer came through the same API any integration
would use. The schedule is the product people love; the ledger is the reason
they can never leave; the API is how it becomes infrastructure."*

## If something breaks

`npm run demo:reset` restores the pristine district in ~10 seconds without
restarting the server. The recording in `demo/` is the insurance copy —
movies don't break.
