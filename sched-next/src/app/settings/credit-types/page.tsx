import { db } from "@/lib/db";
import { currentUser, isAdmin } from "@/lib/demo-user";
import { describePolicy, minutesToUnits, type RoundingMode } from "@/lib/credit-math";
import { fmtDayShort, fmtUnits } from "@/lib/format";
import { acceptCandidate, dismissCandidate } from "./actions";

export const dynamic = "force-dynamic";

// Showing the rounding rule is itself a feature the legacy product lacks
// (SPEC.md Stage 2): the policy is stated in plain language and demonstrated
// against the session lengths this district actually schedules. The P0 layer
// adds where each entry CAME from: curation status, jurisdiction, source
// provenance, and who is authorized to grant it.
const SAMPLE_MINUTES = [15, 50, 60, 75, 90];

const STATUS_LABEL: Record<string, string> = {
  CANDIDATE: "Awaiting review",
  DISTRICT_CANONICAL: "District-defined",
  STATE_CANONICAL: "State canonical",
};

export default async function CreditTypesPage() {
  const user = await currentUser();
  const admin = isAdmin(user);
  const creditTypes = await db.creditType.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: { org: true, authorizations: true, _count: { select: { creditRecords: true } } },
  });
  const candidates = creditTypes.filter((t) => t.status === "CANDIDATE");
  const live = creditTypes.filter((t) => t.status !== "CANDIDATE");

  return (
    <main className="page">
      <div className="pagehead">
        <div className="eyebrow">{creditTypes[0]?.org.name ?? "Organization"} · Settings</div>
        <h1>Credit types and rounding policies</h1>
        <p className="sub">
          Every credit type states its rounding rule in plain language and carries its provenance:
          hand-defined by the district, or landed from a state source by the fetcher and accepted
          here. Nothing a fetcher finds goes live until a person approves it.
        </p>
      </div>

      {candidates.length > 0 && (
        <section
          className="card"
          style={{ marginBottom: 22, borderLeft: "3px solid var(--amber)" }}
          aria-label="Review queue"
        >
          <h2 style={{ marginBottom: 4 }}>Review queue</h2>
          <p style={{ margin: "0 0 12px", color: "var(--slate)", fontSize: 13.5 }}>
            The state fetcher found {candidates.length} entr{candidates.length === 1 ? "y" : "ies"}{" "}
            to review. Accepting publishes an entry as state canonical; dismissing removes it.
          </p>
          {candidates.map((t) => (
            <div
              key={t.id}
              style={{
                display: "flex",
                gap: 12,
                alignItems: "baseline",
                flexWrap: "wrap",
                padding: "10px 0",
                borderTop: "1px solid var(--rule-soft)",
              }}
            >
              <strong>{t.name}</strong>
              {t.jurisdiction && <span className="badge track">{t.jurisdiction}</span>}
              <span style={{ color: "var(--slate)", fontSize: 13 }}>
                {describePolicy(
                  { minutesPerUnit: t.minutesPerUnit, incrementMinutes: t.incrementMinutes, mode: t.roundingMode as RoundingMode },
                  t.unit,
                )}
              </span>
              {t.authorizations.length > 0 && (
                <span className="badge pending">
                  🔒 {t.authorizations.map((a) => a.requiredRole.replace(/_/g, " ").toLowerCase()).join(", ")} only
                </span>
              )}
              <Provenance t={t} />
              {admin && (
                <span style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                  <form action={acceptCandidate.bind(null, t.id)}>
                    <button className="ledger">Accept as state canonical</button>
                  </form>
                  <form action={dismissCandidate.bind(null, t.id)}>
                    <button className="quiet">Dismiss</button>
                  </form>
                </span>
              )}
            </div>
          ))}
        </section>
      )}

      {live.map((t) => {
        const policy = {
          minutesPerUnit: t.minutesPerUnit,
          incrementMinutes: t.incrementMinutes,
          mode: t.roundingMode as RoundingMode,
        };
        return (
          <section key={t.id} className="card" style={{ marginBottom: 18 }} aria-label={t.name}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <h2>{t.name}</h2>
              {t.jurisdiction && <span className="badge track">{t.jurisdiction}</span>}
              <span className={`badge ${t.status === "STATE_CANONICAL" ? "credit" : "track"}`}>
                {STATUS_LABEL[t.status] ?? t.status}
              </span>
              <span className="badge credit num">
                {t._count.creditRecords.toLocaleString()} ledger entries
              </span>
            </div>
            <p style={{ margin: "6px 0 4px" }}>{describePolicy(policy, t.unit)}</p>
            {t.authorizations.length > 0 && (
              <p style={{ margin: "0 0 4px", fontSize: 13.5, color: "var(--amber)", fontWeight: 600 }}>
                🔒 Grant-restricted: only{" "}
                {t.authorizations.map((a) => a.requiredRole.replace(/_/g, " ").toLowerCase()).join(" or ")}{" "}
                staff can check people into sessions carrying this credit — enforced in the write
                path, not the interface.
              </p>
            )}
            <Provenance t={t} />
            <table className="grid" style={{ maxWidth: 520, marginTop: 10 }}>
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

function Provenance({
  t,
}: {
  t: { sourceUrl: string | null; sourceFetchedAt: Date | null; sourceRevision: string | null; sourceConfidence: string | null };
}) {
  if (!t.sourceUrl) return null;
  return (
    <p style={{ margin: 0, fontSize: 12.5, color: "var(--slate)" }}>
      Source:{" "}
      {t.sourceUrl.startsWith("file://")
        ? `${t.sourceUrl.split("/").pop()} (local fixture)`
        : t.sourceUrl.replace(/^https?:\/\//, "").split("/")[0]}
      {t.sourceFetchedAt && <> · fetched {fmtDayShort(t.sourceFetchedAt)}</>}
      {t.sourceRevision && <> · revision <span className="num">{t.sourceRevision}</span></>}
      {t.sourceConfidence && <> · parse confidence {t.sourceConfidence.toLowerCase()}</>}
    </p>
  );
}
