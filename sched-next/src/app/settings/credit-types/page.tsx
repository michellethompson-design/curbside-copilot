import { db } from "@/lib/db";
import { describePolicy, minutesToUnits, type RoundingMode } from "@/lib/credit-math";
import { fmtUnits } from "@/lib/format";

export const dynamic = "force-dynamic";

// Showing the rounding rule is itself a feature the legacy product lacks
// (SPEC.md Stage 2): the policy is stated in plain language and demonstrated
// against the session lengths this district actually schedules.
const SAMPLE_MINUTES = [15, 50, 60, 75, 90];

export default async function CreditTypesPage() {
  const creditTypes = await db.creditType.findMany({
    orderBy: { name: "asc" },
    include: { org: true, _count: { select: { creditRecords: true } } },
  });

  return (
    <main className="page">
      <div className="pagehead">
        <div className="eyebrow">{creditTypes[0]?.org.name ?? "Organization"} · Settings</div>
        <h1>Credit types and rounding policies</h1>
        <p className="sub">
          Every credit type states its rounding rule in plain language, and the table under each one
          shows exactly what a session of a given length awards. No spreadsheet reconciliation, no
          judgment calls at the door.
        </p>
      </div>

      {creditTypes.map((t) => {
        const policy = {
          minutesPerUnit: t.minutesPerUnit,
          incrementMinutes: t.incrementMinutes,
          mode: t.roundingMode as RoundingMode,
        };
        return (
          <section key={t.id} className="card" style={{ marginBottom: 18 }} aria-label={t.name}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <h2>{t.name}</h2>
              <span className="badge credit num">
                {t._count.creditRecords.toLocaleString()} ledger entries
              </span>
            </div>
            <p style={{ margin: "6px 0 12px" }}>{describePolicy(policy, t.unit)}</p>
            <table className="grid" style={{ maxWidth: 520 }}>
              <thead>
                <tr>
                  <th className="num">Session length</th>
                  <th className="num">Awards</th>
                </tr>
              </thead>
              <tbody>
                {SAMPLE_MINUTES.map((m) => (
                  <tr key={m}>
                    <td className="num">{m} minutes</td>
                    <td className="num">
                      {fmtUnits(minutesToUnits(m, policy))} {t.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </main>
  );
}
