# Witness — production trace mining

Saša's agent recovers what the code says; Witness recovers what production
**does**; the gap between them is where rebuilds die. The same trace format
later becomes the shadow-mode harness that verifies every NestJS module before
a tenant flips.

Three components, per the PRD:

| Component | File | What it does |
|---|---|---|
| Tracer | `src/Witness.php` | One dependency-free class. `Witness::observe()` logs one redacted JSON line per boundary call. |
| Miner | `bin/mine.php` | Batches traces per boundary, asks Claude the Daikon question, writes `/docs/invariants/<boundary>.md`. |
| Diff | `bin/diff-invariants.php` | Compares two invariant docs; appeared/vanished rules exit non-zero (behavior-change alarm). Same logic diffs legacy vs. shadow traces later. |

Plus: `bin/purge-traces.php` (90-day retention), `config/boundaries.php`
(allowlists + sampling for the 8 PRD boundaries), `tests/run.php` (no
framework — `php witness/tests/run.php`), and
`examples/generate-sample-traces.php` (synthetic data for an end-to-end demo).

## Instrumenting a boundary (the whole integration)

Bootstrap once (wherever the legacy app initializes):

```php
require '/path/to/witness/src/Witness.php';

Witness::configure([
    'salt'       => getenv('WITNESS_SALT'),        // treat like a credential
    'trace_dir'  => '/var/sched/witness',          // or 'sink' => fn(array $lines) => ... for a DB table
    'on_error'   => fn(\Throwable $e) => Sentry\captureException($e),
    'boundaries' => require '/path/to/witness/config/boundaries.php',
]);
```

Then at each boundary — hand-placed, max the 8 in the PRD:

```php
Witness::observe('registration.pricing', $inputs, $outputs, ['tenant_id' => $orgId]);
```

That's it. Guarantees:

- **Fail-open.** `observe()` never throws. Broken disk, broken config, broken
  sink — the customer request proceeds untouched, and the failure goes to
  `on_error` (Sentry).
- **Off the hot path.** Traces buffer in memory and write once, after the
  response, via a shutdown function (`LOCK_EX` append). Long-running workers
  call `Witness::flush()` between jobs.
- **Redaction is structural, not optional.** The per-boundary allowlist in
  `config/boundaries.php` is the privacy boundary: `keep` for business values
  (plan, amounts, statuses, flags), `hash` for identifiers (salted HMAC —
  joinable within our data, not reversible), and **no entry = dropped before
  anything is buffered**. Emails, names, addresses, and free text never get an
  allowlist entry. A `_dropped` count records how much was withheld.
- **Sampling is config.** `sample_rate` per boundary: 1.0 on rare paths
  (pricing, CFP transitions), 0.05 on hot paths (permission checks, check-in).
- **Kill switch.** `'enabled' => false` (or an env-driven flag) turns the whole
  thing off without touching call sites.

## Mining

```sh
# Demo without production data or an API key:
php witness/examples/generate-sample-traces.php var/witness-sample
php witness/bin/mine.php --boundary=registration.pricing \
    --traces='var/witness-sample/witness-*.jsonl' --dry-run   # prints the prompt

# Real run (weekly cron), one boundary per invocation:
ANTHROPIC_API_KEY=... php witness/bin/mine.php \
    --boundary=registration.pricing \
    --traces='/var/sched/witness/witness-*.jsonl' \
    --out=docs/invariants
```

The miner streams the JSONL files (reservoir-samples down to `--max-traces`,
default 400), computes per-field value-frequency stats in PHP so the model
reasons from counted facts, and asks for four sections: **Always true**,
**True ~99% of the time — with exceptions** (the priority output — the
exceptions and their distinguishing fields are where edge-case rules live),
**Suspicious patterns**, and **Coverage caveats**. Output is a markdown file
stamped with the observation window, committed to `docs/invariants/` as the
living business-logic doc. Default model is `claude-opus-5` (override with
`--model=`). The script is raw-HTTPS/curl on purpose so it runs from cron on
the legacy stack with zero dependencies; if Composer is ever on the table, the
official SDK is `anthropic-ai/sdk`.

The synthetic sample data embeds a known edge case (one grandfathered
`legacy-edu` university tenant keeps a member discount the rule says it
shouldn't get) — a correct mining run surfaces it under the ~99% section.

## Weekly diff (P1) and shadow mode (P2)

```sh
php witness/bin/diff-invariants.php docs/invariants/prev/registration-pricing.md \
                                    docs/invariants/registration-pricing.md
```

Exit 1 with `APPEARED:`/`VANISHED:` lines when the rule set changed — wire
that into the weekly cron as the behavior-change alarm. Normalization ignores
evidence counts and formatting, so only real rule changes fire.

Shadow mode is **designed for, not built**: a NestJS module emitting the same
`Witness` JSONL schema (`v`, `boundary`, `ts`, `tenant`, `inputs`, `outputs`)
can be diffed against legacy traces with this exact script — per-tenant,
because both sides hash tenants with the same salt (open question #4: salt
management lives wherever secrets live, and must be shared with the NestJS
side at that point).

## Privacy & compliance (P0)

- Traces are customer data. Store `trace_dir` on production-grade storage with
  the same access control as any prod data store (SOC 2 note for the next
  audit evidence cycle).
- **Retention: 90 days**, enforced by daily cron —
  `php witness/bin/purge-traces.php --dir=/var/sched/witness --days=90`.
  Files are date-partitioned so purging is a file delete. Mined invariant docs
  contain no raw data and persist indefinitely.
- Claude API usage goes through the existing Anthropic setup; document it in
  the internal AI-use policy + subprocessor disclosures (Michelle owns).
  What leaves our boundary is only what survived the allowlist: already
  redacted, identifiers already hashed.

## Acceptance test

Given 2+ weeks of production traces on `registration.pricing`, the miner must
produce at least one true business rule absent from Saša's agent output and
the cartography findings — verified by Saša or Tony. If it doesn't, re-examine
boundary choice before expanding.
