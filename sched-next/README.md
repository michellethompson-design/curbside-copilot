# Sched Next — one-day build

PD-first, API-first event platform prototype: the schedule product Sched is
loved for, wrapped around an append-only CE/PD credit ledger, exposed through
a REST API with a read-only MCP server on top. Context and constraints live in
[`CLAUDE.md`](./CLAUDE.md); the staged plan in [`SPEC.md`](./SPEC.md); the
one-day run sheet in [`ONEDAY.md`](./ONEDAY.md); product calls in
[`DECISIONS.md`](./DECISIONS.md); the walkthrough in [`DEMO.md`](./DEMO.md).

## Run it

```bash
npm install
npm run demo:reset   # build + seed the SQLite database (idempotent, ~10s)
npm run dev          # http://localhost:3000
npm test             # credit-math unit tests (the rounding table)
```

Seeded world: Keystone Valley School District — Dana's 42-session inservice
(1,200 people, Act 48 hours at quarter-hour nearest), a 600-session stress
event, and two historical events so transcripts span years. The top-bar
switcher impersonates **Dana Whitfield** (PD coordinator), **Ruth Alvarez**
(org owner), or **Marcus Bell** (attendee) — no auth in the demo build.

## Exit-test scripts

```bash
npx tsx scripts/verify-ledger.ts   # 20 check-ins, correction offsets, guard rejects mutation
npx tsx scripts/verify-mcp.ts      # MCP over stdio answers the missing-credits question (app must be running)
```

`verify-ledger.ts` writes to the database; run `npm run demo:reset` after.

## State credit-type catalog (P0 slice)

Credit types carry curation status (candidate / district-defined / state
canonical), jurisdiction, and source provenance. Grant-restricted types
(e.g. Act 45 PIL Hours → `PIL_AUTHORIZED`) are enforced in the check-in
write path — no admin bypass. The state fetcher lands candidates for review
in settings; nothing goes live until accepted:

```bash
npx tsx scripts/fetch-state-credit-types.ts --jurisdiction TX --file fixtures/tea-cpe-sample.html
npx tsx scripts/fetch-state-credit-types.ts --jurisdiction TX --url https://tea.texas.gov/…   # live, run locally
npx tsx scripts/verify-p0.ts   # exit test: role gate + fetcher lifecycle
```

## Legacy Sched bridge

Pull a real event from any legacy `*.sched.com` site into the credit core:

```bash
# Public ICS export — no credentials, sessions only:
npx tsx scripts/import-sched.ts --ics https://SUBDOMAIN.sched.com/all.ics --credit "Act 48"

# Event API key — sessions and people:
npx tsx scripts/import-sched.ts --api SUBDOMAIN --key SCHED_API_KEY --credit "Act 48"
```

Imports are idempotent (re-running updates in place; nothing duplicates) and
attendance is deliberately not imported: check-in is the credit-bearing act
and happens here, where the ledger vouches for it. Legacy Sched keeps the
schedule; this side becomes the system of record. A Sched-format fixture and
worked example live in `fixtures/sched-sample.ics`. API mode is written to
Sched's documented per-event export endpoints; verify field names once
against a real key (this sandbox can't reach external hosts).

## MCP server

`npm run mcp` starts a stdio MCP server wrapping the REST API — five read-only
tools, no logic of its own. Claude connection config: [`mcp/README.md`](./mcp/README.md).

## Map

```
prisma/schema.prisma   Stage 0 data model (Postgres-compatible, SQLite today)
prisma/seed.ts         Deterministic district seed; demo:reset truncates in place
src/lib/credit-math.ts Rounding policies → units (unit-tested)
src/lib/db.ts          Prisma client + append-only ledger guard
src/lib/ledger.ts      The only ledger write paths: check-in and correction
src/lib/{transcript,compliance,schedule}.ts  Derived views shared by pages and API
src/app/api/…          REST API (the contract; MCP wraps these routes)
src/app/…              Pages: events, schedule, session, check-in, transcript,
                       compliance, settings, certificates, agenda
mcp/server.ts          Read-only MCP wrapper over the API
scripts/               Exit-test proofs
```
