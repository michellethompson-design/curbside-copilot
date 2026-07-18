import { db } from "@/lib/db";
import { currentUser } from "@/lib/demo-user";
import { CLAIM_STATUS_LABEL } from "@/lib/claims";
import { fmtDayShort, fmtUnits } from "@/lib/format";
import { resubmitClaimAction, submitClaimAction } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  SUBMITTED: "track",
  UNDER_REVIEW: "pending",
  CHANGES_REQUESTED: "adjust",
  APPROVED: "credit",
  REJECTED: "adjust",
};

// Off-platform PD: the regional conference, the book study, the workshop that
// didn't happen on this platform. Submit it with evidence; an admin reviews;
// approval writes it to the same ledger everything else lives on.
export default async function MyClaimsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const sp = await searchParams;
  const user = await currentUser();
  if (!user) return null;
  const [claims, creditTypes] = await Promise.all([
    db.claim.findMany({
      where: { personId: user.id },
      orderBy: { createdAt: "desc" },
      include: { creditType: true, events: { orderBy: { createdAt: "asc" } } },
    }),
    db.creditType.findMany({ where: { status: { not: "CANDIDATE" } }, orderBy: { name: "asc" } }),
  ]);

  async function submit(formData: FormData) {
    "use server";
    const { redirect } = await import("next/navigation");
    const result = await submitClaimAction(formData);
    redirect(result.ok ? "/me/claims?ok=1" : `/me/claims?error=${encodeURIComponent(result.error ?? "Submission failed")}`);
  }
  async function resubmit(formData: FormData) {
    "use server";
    const { redirect } = await import("next/navigation");
    const result = await resubmitClaimAction(formData);
    redirect(result.ok ? "/me/claims?ok=1" : `/me/claims?error=${encodeURIComponent(result.error ?? "Resubmission failed")}`);
  }

  return (
    <main className="page">
      <div className="pagehead">
        <div className="eyebrow">Off-platform PD</div>
        <h1>Submit outside learning for credit</h1>
        <p className="sub">
          PD that happened off this platform — a regional conference, a book study — can still land
          on your transcript. Submit it with evidence; once an administrator approves it, the credit
          is written to the same ledger as everything else, marked self-reported and admin-approved.
        </p>
      </div>

      {sp.error && (
        <p role="alert" style={{ color: "var(--red)", fontWeight: 600 }}>
          {sp.error}
        </p>
      )}
      {sp.ok && (
        <p role="status" style={{ color: "var(--ledger-deep)", fontWeight: 600 }}>
          Claim submitted — it&rsquo;s in the review queue.
        </p>
      )}
      <form action={submit} className="card" style={{ marginBottom: 24, display: "grid", gap: 10, maxWidth: 640 }}>
        <h2>New claim</h2>
        <label>
          Activity title
          <input type="text" name="title" required placeholder="e.g. Regional Literacy Conference keynote track" style={{ width: "100%" }} />
        </label>
        <label>
          Provider
          <input type="text" name="provider" required placeholder="Who ran it" style={{ width: "100%" }} />
        </label>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <label>
            Date
            <input type="text" name="activityDate" required placeholder="2026-06-20" style={{ width: 130 }} />
          </label>
          <label>
            Credit type
            <select name="creditTypeId" required>
              {creditTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Units requested
            <input type="text" name="unitsRequested" required placeholder="3.0" style={{ width: 80 }} className="num" />
          </label>
        </div>
        <label>
          Evidence (PDF/PNG/JPEG, max 5 MB — agenda, certificate of attendance, sign-in)
          <input type="file" name="evidence" accept=".pdf,.png,.jpg,.jpeg" />
        </label>
        <label>
          Note to the reviewer
          <input type="text" name="note" placeholder="Anything that helps the reviewer" style={{ width: "100%" }} />
        </label>
        <div>
          <button className="primary" type="submit">
            Submit claim
          </button>
        </div>
      </form>

      <h2 style={{ marginBottom: 10 }}>My claims</h2>
      {claims.length === 0 && <p style={{ color: "var(--slate)" }}>No claims yet.</p>}
      {claims.map((c) => (
        <section key={c.id} className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
            <strong>{c.title}</strong>
            <span style={{ color: "var(--slate)" }}>{c.provider}</span>
            <span className="num" style={{ color: "var(--slate)" }}>{fmtDayShort(c.activityDate)}</span>
            <span className="badge credit num">
              {fmtUnits(c.unitsRequested)} {c.creditType.name}
            </span>
            <span className={`badge ${STATUS_BADGE[c.status]}`}>{CLAIM_STATUS_LABEL[c.status]}</span>
            {c.evidenceName && (
              <a href={`/api/claims/${c.id}/evidence`} style={{ fontSize: 12.5 }}>
                {c.evidenceName}
              </a>
            )}
          </div>
          {c.events.filter((e) => e.note).length > 0 && (
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--slate)" }}>
              Latest reviewer note: {c.events.filter((e) => e.note).at(-1)?.note}
            </p>
          )}
          {c.status === "CHANGES_REQUESTED" && (
            <form action={resubmit} style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <input type="hidden" name="claimId" value={c.id} />
              <input type="text" name="note" required placeholder="What changed" style={{ flex: 1, minWidth: 220 }} />
              <input type="file" name="evidence" accept=".pdf,.png,.jpg,.jpeg" />
              <button type="submit">Resubmit</button>
            </form>
          )}
        </section>
      ))}
    </main>
  );
}
