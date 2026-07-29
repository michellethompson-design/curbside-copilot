# Mined invariants

One markdown file per instrumented boundary, produced by `witness/bin/mine.php`
from ≥1 week of redacted production traces. These are the living business-logic
docs for the rebuild: an engineer builds the NestJS module against them, and
Saša annotates each rule as **contractual / bug / accident / unknown** (P1
annotation pass) directly below the rule.

Workflow:

1. Weekly cron runs the miner per boundary and rewrites the file here.
2. `witness/bin/diff-invariants.php` compares against the previous commit;
   appeared/vanished rules are the behavior-change alarm.
3. Annotations survive: the generator only owns the rule bullets — keep
   annotations as indented sub-bullets so a regenerate + human re-merge is a
   reviewable diff.

`registration-pricing.example.md` is a **hand-written sample of the expected
format** generated from the synthetic dataset in
`witness/examples/generate-sample-traces.php` — not real production output.
Delete it once the first real mining runs land.

Raw traces never live in this directory. Files here contain no customer data
and persist indefinitely; the trace store itself is purged at 90 days.
