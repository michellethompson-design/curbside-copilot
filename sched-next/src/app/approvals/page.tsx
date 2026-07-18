import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { currentUser, isAdmin } from "@/lib/demo-user";
import { CLAIM_STATUS_LABEL } from "@/lib/claims";
import { REASON_CODES } from "@/lib/corrections";
import { fmtDayShort, fmtTime, fmtUnits } from "@/lib/format";
import { claimAction, correctionAction } from "./actions";

export const dynamic = "force-dynamic";

// The reviewer's desk: off-platform claims and correction requests, both of
// which end in ledger writes — which is exactly why they get a queue and a
// second pair of eyes instead of a quiet edit.
export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ note?: string }>;
}) {
  const sp = await searchParams;
  const user = await currentUser();
  if (!isAdmin(user)) redirect("/");

  const [claims, corrections] = await Promise.all([
    db.claim.findMany({
      where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
      orderBy: { createdAt: "asc" },
      include: { person: true, creditType: true },
    }),
    db.correctionRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const sessionIds = [...new Set(corrections.map((c) => c.sessionId))];
  const personIds = [...new Set(corrections.flatMap((c) => [c.personId, c.requestedById]))];
  const [sessions, people] = await Promise.all([
    db.session.findMany({ where: { id: { in: sessionIds } } }),
    db.person.findMany({ where: { id: { in: personIds } } }),
  ]);
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const personById = new Map(people.map((p) => [p.id, p]));
  const reasonLabel = (code: string) => REASON_CODES.find((r) => r.code === code)?.label ?? code;

  return (
    <main className="page wide">
      <div className="pagehead">
        <div className="eyebrow">Approvals</div>
        <h1>Waiting on a decision</h1>
        <p className="sub">
          Everything here ends in a ledger write, so it gets a queue and a named decision instead of
          a quiet edit. Corrections need a second admin — the requester can never approve their own.
        </p>
      </div>

      {sp.note && (
        <p role="status" style={{ color: "var(--ledger-deep)", fontWeight: 600 }}>
          {sp.note}
        </p>
      )}
      <h2 style={{ margin: "6px 0 10px" }}>
        Off-platform claims <span className="badge pending num">{claims.length}</span>
      </h2>
      {claims.length === 0 && <p style={{ color: "var(--slate)" }}>Queue is clear.</p>}
      {claims.map((c) => (
        <section key={c.id} className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
            <strong>{c.person.name}</strong>
            <span>{c.title}</span>
            <span style={{ color: "var(--slate)" }}>{c.provider}</span>
            <span className="num" style={{ color: "var(--slate)" }}>{fmtDayShort(c.activityDate)}</span>
            <span className="badge credit num">
              requests {fmtUnits(c.unitsRequested)} {c.creditType.name}
            </span>
            <span className="badge track">{CLAIM_STATUS_LABEL[c.status]}</span>
            {c.evidenceName ? (
              <a href={`/api/claims/${c.id}/evidence`} style={{ fontSize: 12.5 }}>
                evidence: {c.evidenceName}
              </a>
            ) : (
              <span className="badge adjust">no evidence attached</span>
            )}
          </div>
          {c.note && <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--slate)" }}>“{c.note}”</p>}
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
            {c.status === "SUBMITTED" && (
              <form action={claimAction}>
                <input type="hidden" name="claimId" value={c.id} />
                <input type="hidden" name="toStatus" value="UNDER_REVIEW" />
                <button type="submit">Start review</button>
              </form>
            )}
            <form action={claimAction} style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="hidden" name="claimId" value={c.id} />
              <input type="hidden" name="toStatus" value="APPROVED" />
              <label style={{ fontSize: 12.5, fontWeight: 600 }}>
                Units
                <input
                  type="text"
                  name="unitsApproved"
                  defaultValue={fmtUnits(c.unitsRequested)}
                  className="num"
                  style={{ width: 70, marginLeft: 6 }}
                />
              </label>
              <button className="ledger" type="submit">
                Approve → ledger
              </button>
            </form>
            <form action={claimAction} style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="hidden" name="claimId" value={c.id} />
              <input type="hidden" name="toStatus" value="CHANGES_REQUESTED" />
              <input type="text" name="note" required placeholder="What needs to change" style={{ width: 200 }} />
              <button type="submit">Request changes</button>
            </form>
            <form action={claimAction} style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="hidden" name="claimId" value={c.id} />
              <input type="hidden" name="toStatus" value="REJECTED" />
              <input type="text" name="note" required placeholder="Reason" style={{ width: 160 }} />
              <button className="quiet" type="submit">
                Reject
              </button>
            </form>
          </div>
        </section>
      ))}

      <h2 style={{ margin: "28px 0 10px" }}>
        Correction requests <span className="badge pending num">{corrections.length}</span>
      </h2>
      {corrections.length === 0 && <p style={{ color: "var(--slate)" }}>Queue is clear.</p>}
      {corrections.map((r) => {
        const session = sessionById.get(r.sessionId);
        const isOwn = r.requestedById === user!.id;
        return (
          <section key={r.id} className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
              <strong>{personById.get(r.personId)?.name ?? "?"}</strong>
              <span>
                {session ? (
                  <Link href={`/sessions/${session.id}`}>{session.title}</Link>
                ) : (
                  "(session)"
                )}
              </span>
              {session && (
                <span className="num" style={{ color: "var(--slate)" }}>
                  {fmtDayShort(session.startsAt)} {fmtTime(session.startsAt)}
                </span>
              )}
              <span className="badge adjust">{reasonLabel(r.reasonCode)}</span>
              <span style={{ color: "var(--slate)", fontSize: 13 }}>
                requested by {personById.get(r.requestedById)?.name ?? "?"} · {fmtDayShort(r.createdAt)}
              </span>
            </div>
            {r.reason && <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--slate)" }}>“{r.reason}”</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
              {isOwn ? (
                <span className="badge pending">Waiting for a second admin — you requested this one</span>
              ) : (
                <>
                  <form action={correctionAction} style={{ display: "flex", gap: 6 }}>
                    <input type="hidden" name="requestId" value={r.id} />
                    <input type="hidden" name="decision" value="approve" />
                    <button className="ledger" type="submit">
                      Approve — write offsetting entries
                    </button>
                  </form>
                  <form action={correctionAction} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input type="hidden" name="requestId" value={r.id} />
                    <input type="hidden" name="decision" value="reject" />
                    <input type="text" name="note" placeholder="Why not" style={{ width: 160 }} />
                    <button className="quiet" type="submit">
                      Reject
                    </button>
                  </form>
                </>
              )}
            </div>
          </section>
        );
      })}
    </main>
  );
}
