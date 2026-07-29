<!-- SAMPLE ONLY: hand-written illustration of the miner's output format, based on
     the synthetic dataset in witness/examples/generate-sample-traces.php.
     Real mined docs replace this file. -->
# Invariants: registration.pricing

- **Observation window:** 2026-07-29T00:00:00Z to 2026-07-29T00:00:00Z (UTC)
- **Traces:** 800 total, 400 sampled for mining
- **Mined:** 2026-07-29 · model `claude-opus-5` *(sample: hand-written, not a real run)*

---

## Always true

- Total always equals base_price minus discount, to the cent (held in 400/400).
  - [annotation: _contractual / bug / accident / unknown_ — Saša]
- Currency is always USD on both input and output (held in 400/400).
- base_price is always 25.00 × quantity — there is no plan- or org-type-based
  price variation in this window (held in 400/400).
- error_code is always null; no failing pricing calls were observed (held in 400/400).
- General (non-member) tickets never receive a discount (held in ~100/100 general-ticket traces).

## True ~99% of the time — with exceptions

- **Member tickets on a `free` plan receive no discount** — held in 293/300
  member-ticket traces. The 7 exceptions all share `plan='legacy-edu'`,
  `org_type='university'`, and the **same tenant hash**, and each received the
  full 20% member discount despite not being on a paid plan. This looks like a
  grandfathered per-tenant entitlement, not noise: one tenant, consistent
  behavior, every time it appears.
  - [annotation: — ]
- Member tickets on paid plans always receive exactly 20% off base
  (held in every paid-plan member trace; no other discount percentage observed).

## Suspicious patterns

- None observed in this window: no contradictory outputs for identical inputs,
  no error codes co-occurring with computed totals.

## Coverage caveats

- Single-day synthetic window — no seasonal paths (renewal pricing, early-bird
  windows) can appear here.
- `promo_code_applied` is always false in this sample; promo behavior is
  entirely unobserved.
- Redaction drops one input field per trace (`_dropped: 1`); if that field
  participates in pricing decisions, its rules are invisible to mining —
  review the allowlist if exceptions can't be explained by visible fields.
