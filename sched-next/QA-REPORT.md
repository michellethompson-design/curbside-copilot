# QA Report — 2026-07-18

**Method.** Seven parallel QA agents, one functional area each (schedule/nav,
check-in & ledger integrity, transcript/compliance/exports, certificates &
verification, claims & corrections, auth & organizer CRUD, adversarial inputs
& API contract), driving the running app through the browser and the REST API
with database cross-checks. Every reported finding was then independently
reproduced by a separate verifier agent following only the written repro
steps before being accepted. 25 agents, ~420 tool operations.

**Result: 18 confirmed findings (1 critical, 6 major, 7 minor, 4 cosmetic),
0 false positives, 80 documented passes.** All 18 were fixed the same day
except one accepted-as-designed item, and each fix was re-verified against
the original repro.

## Findings and dispositions

| # | Sev | Area | Finding | Disposition |
|---|-----|------|---------|-------------|
| 1 | **Critical** | Claims | Claim approval wrote grant-restricted credit (Act 45 PIL) for a non-authorized approver — the P0 authority guard only covered check-in | **Fixed**: approval enforces `CreditTypeAuthorization` (org-wide role required) and stamps `credit_type_authorization_role` on the award, same as the door |
| 2 | Major | Certificates | Certificate page had no authorization: any user could view (and mint) anyone's certificate, exposing license IDs | **Fixed**: owner-or-admin only; third parties verify by UCID at /verify |
| 3 | Major | Claims | Evidence uploads between ~1 MB and the advertised 5 MB limit failed with HTTP 500 (server-action body limit) | **Fixed**: action body limit raised to 8 MB; verified with a 1.8 MB PNG |
| 4 | Major | Claims | All server-side claim validation failures were silent — the form reset with no message | **Fixed**: errors and confirmations surface on the page |
| 5 | Major | Claims | Activity dates displayed one day earlier than entered (UTC-midnight parse rendered in ET) | **Fixed**: dates anchor at noon UTC; verified rendering |
| 6 | Major | Organizer | Sessions on standard-time (winter) dates displayed one hour off — the wall-time helper hardcoded EDT | **Fixed**: DST-correct conversion; Nov 9:00 ET = 14:00Z, Aug 9:00 ET = 13:00Z |
| 7 | Major | API/compliance | Malformed `from`/`to` date params returned bare 500s, and the compliance page's free-text date fields could 500 the page | **Fixed**: APIs return 400 with guidance; the page ignores bad dates with an inline note |
| 8 | Major | Mobile | Top nav didn't wrap at phone widths: ~600 px horizontal overflow, several nav items and the user switcher unreadable/unreachable | **Fixed**: header wraps; wide tables scroll in their own box; 0 px overflow at 375 px |
| 9 | Minor | Check-in | Overlap error told door staff to "Undo that one first" — an action they don't have | **Fixed**: role-neutral guidance naming the correction flow |
| 10 | Minor | Compliance | Pasting a full PPID as displayed found nothing (case-sensitive match) | **Fixed**: case-insensitive |
| 11 | Minor | Compliance | Non-numeric threshold rendered "Below NaN hours" | **Fixed**: falls back to 6 with a visible note |
| 12 | Minor | Compliance | Negative threshold flagged all zero-record people as "needs −5.00" | **Fixed**: zero-record people only count when the requirement is positive; page clamps |
| 13 | Minor | Claims | Approving with adjusted units gave the reviewer no confirmation of what was awarded | **Fixed**: confirmation line names units, type, and person |
| 14 | Minor | Adversarial | 10,000-character claim titles blew page width to ~100,000 px | **Fixed**: 200-char title cap + `overflow-wrap` on cards |
| 15 | Minor | Verification | `/verify/<garbage>` returns a polite not-found page with HTTP 200 | **Accepted**: the HTML page keeps its guidance copy; the JSON API returns a proper 404 |
| 16 | Cosmetic | Events | Single-day events rendered "March 13–March 13, 2026" | **Fixed**: collapses to one date |
| 17 | Cosmetic | Events | Same, for organizer-created one-day events | **Fixed** (same change) |
| 18 | Cosmetic | Compliance | Empty person-search showed a bare table with no message | **Fixed**: "no matches" row with guidance |

## What passed (80 checks — highlights)

Credit math verified in the database against policy for 90/50-minute sessions;
overlap rule, bulk check-in row-per-person integrity, and the append-only
guard (update/delete/deleteMany all rejected); role gates from both sides
(door-staff scope, Act 45 block/allow, attendee redirects); transcript totals
net of adjustments and filter correctness against the API; all four export
presets parsed with correct quoting, formats, and cross-checked hours; UCID
format/stability/supersession and PII discipline on /verify; the full claim
state machine including terminal-state locking and forbidden evidence access;
token single-use, httpOnly session cookie, bulk-paste idempotency, delete
guards; XSS strings render inert everywhere tested; unicode titles survive
end to end; 600-session views stay fast.

Full agent-level detail lives in the workflow transcript (not committed).
