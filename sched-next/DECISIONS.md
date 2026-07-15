# DECISIONS.md — one line per product call, and why

Running log per SPEC.md Working Notes. Ammunition for later.

- **SQLite with string-backed enums.** Prisma enums aren't supported on SQLite; documented string unions keep the schema Postgres-compatible per CLAUDE.md. Swap the datasource, keep the models.
- **Roles are scoped grants, not a column.** `Role(personId, level, eventId?)` implements the ratified four-level model; event-admin scope carries the eventId.
- **Speakers are a display string on Session.** Nothing in the demo path hangs on speaker identity; a Speaker join table is full-build work, not one-day work.
- **Seed grew two small historical events beyond ONEDAY's pair.** The Stage 2 exit test is a *multi-year* transcript and the missing-credits question needs a real distribution; an August 2025 inservice and a spring 2026 PD day supply both. Dana's story event and the stress event are unchanged.
- **Session credit derives from scheduled minutes through the policy; keynotes pin `fixedUnits`.** Deriving keeps credit honest to the schedule; the override models flat-award realities (and demos that both exist).
- **NEAREST breaks ties upward.** 7.5 minutes at quarter-hour rounds to 15 — ties resolve in the educator's favor, and the tests pin it so it never drifts.
- **Corrections offset; attendance deletes.** CreditRecord is the auditable ledger: append-only, guard enforced in the data layer (`src/lib/db.ts`), corrections linked to the entry they offset with a required reason. Attendance is operational state and may be corrected in place.
- **Overlap rule lives in the check-in service.** No verified attendance in two overlapping sessions; the error names the clashing session. Retro check-in allowed, actor recorded.
- **Pages share the service layer with the API routes instead of fetching localhost.** The API stays the contract (the MCP server consumes it over real HTTP); the pages calling the same functions avoids a self-HTTP hop on every render in a one-day scope.
- **`demo:reset` truncates in place rather than deleting the database file.** A deleted SQLite file leaves a running server holding the old inode — reset must be usable mid-demo.
- **Missing-credits includes people with zero ledger entries.** Absence from the ledger is the loudest shortfall; a threshold report that only ranks people who attended would flatter the district.
- **The Act 48/PERMS CSV format is mocked and labeled as such** everywhere it appears (UI copy, code comment, demo script). The scene's claim is "the export matches what Dana reports," not "we are PERMS-certified."
- **Unit display never rounds up a floor policy.** 0.025 CEUs renders as 0.025, not 0.03 — a transcript number that contradicts the stated policy would burn the demo's one asset, trust.
- **Certificates derive from net ledger credit; none are stored.** No credit, no certificate; corrected credit uncertifies itself. Reissue is just reloading the page, which is the feature.
- **Today's cuts honored** (ONEDAY.md): no auth, no ICS, no embeds, no OpenAPI page, no QR. They return in the full build; none of them are load-bearing for Dana's story.
- **Legacy bridge imports schedule and people, never attendance.** The integration thesis is that legacy Sched keeps the schedule it is loved for while this side owns the credit-bearing record; importing legacy attendance would launder unverifiable check-ins into an auditable ledger. Sessions key on their source id (ICS UID / API key) and events on their source subdomain, so re-imports update in place — the SPEC Stage 1 idempotency rule.
- **ICS mode first, API mode written-but-unverified.** Every public legacy event site serves `all.ics` with zero credentials, so that path is fully testable (fixture in `fixtures/`); the API mapper accepts the documented field-name variants and says out loud that it needs one verification pass with a real key.
