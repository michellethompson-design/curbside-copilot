---
name: cash-runway
description: Compute and report the business's cash runway — cash on hand, monthly net burn, and months of runway remaining — pulling live numbers from connected finance tools (QuickBooks, Ramp, Stripe) or from exported statements when no tools are connected. Use this whenever the user asks about runway, burn rate, "how many months of cash do we have", "can we afford X", cash position, when they'll run out of money, or whether a planned hire/spend fits the budget — even if they don't say the word "runway".
---

# Cash Runway

Produce a clear, decision-ready answer to one question: **how long can the
business keep operating at its current pace before cash runs out?**

Runway is only useful if the inputs are real. Prefer live data from connected
finance tools; fall back to files the user provides; never invent numbers. If a
required input is unavailable, say exactly what's missing and compute what you
can with what you have, labeling it clearly as partial.

## Step 1 — Establish cash on hand

Gather every cash balance the business can actually spend, as of today:

- **Bank / operating accounts** — QuickBooks balance sheet (bank-type accounts)
  or Ramp business account balance if Ramp is the operating account.
- **Treasury / savings** — Ramp treasury or investment account balances.
- **Stripe balance** — funds captured but not yet paid out.

Watch for double counting: a Stripe payout that has already landed in the bank
account must not be counted twice, and QuickBooks bank balances may lag real
bank balances by unreconciled days. When two sources disagree, use the more
current one and note the discrepancy in the report.

Do **not** count accounts receivable as cash. Report AR separately as upside
(Step 4) — unpaid invoices don't make payroll.

## Step 2 — Establish monthly net burn

Net burn = cash out minus cash in, per month. Compute it from the **trailing
three full months** — a single month is too noisy (annual renewals, one-time
payments), and longer windows hide recent changes in spending.

- Best source: a monthly cash-flow statement (QuickBooks cash flow report).
- Otherwise: monthly expense totals (Ramp transactions, bank export) minus
  monthly cash receipts (Stripe payouts, deposits).

Then adjust for what the trailing average can't see:

- **Remove true one-offs** (equipment purchase, legal settlement) — but only if
  genuinely non-recurring. Annual subscriptions are recurring; amortize them
  monthly instead of removing them.
- **Add known upcoming changes**: a signed hire, a rent increase, a committed
  new contract. State each adjustment and its monthly impact explicitly.

If cash in exceeds cash out, the business is cash-flow positive — say so
plainly; runway is not the binding constraint.

## Step 3 — Compute runway

```
runway (months) = cash on hand ÷ monthly net burn
```

Report the date cash reaches zero, not just a month count — "out of cash
around March 2027" lands harder than "8.3 months". Round to one decimal at
most; false precision undermines trust in the whole report.

## Step 4 — Scenarios and near-term risks

A single number hides the range. Always give three cases:

- **Base**: trailing-average burn with the Step 2 adjustments.
- **Conservative**: worst single month of burn in the trailing window, and
  assume slow-paying AR stays unpaid.
- **Upside**: base burn plus collection of current AR (from QuickBooks AR
  aging) and any committed revenue.

Also surface anything that breaks the smooth-burn assumption within the
runway window: large AP coming due (QuickBooks AP aging), annual renewals,
tax payments, debt payments.

## Report format

Keep the whole report short enough to read in one screen:

```
# Cash Runway — [date]

**Runway: X.X months — cash reaches zero around [Month Year].**

## Cash on hand: $XXX,XXX
[one line per source with balance and as-of date]

## Monthly net burn: $XX,XXX
[trailing 3-month figures, adjustments made and why]

## Scenarios
- Conservative: X.X months ([driver])
- Base: X.X months
- Upside: X.X months ([driver])

## Watch items
[dated, specific: "Annual insurance renewal ~$12k due Oct", "AR >60 days: $18k"]
```

If the user asked a specific question ("can we afford a $90k hire?"), answer
it first, in one sentence, before the report: state the new burn, the new
runway, and whether that leaves an acceptable buffer (12+ months is generally
comfortable; under 6 means the decision needs a revenue or funding plan
attached).
