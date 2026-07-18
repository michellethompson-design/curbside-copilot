import type { Metadata } from "next";
import Link from "next/link";
import { verifyUcid } from "@/lib/certificates";
import { fmtDateRange, fmtDayShort, fmtUnits } from "@/lib/format";

export const dynamic = "force-dynamic";

// Non-indexable by design: verification is for someone holding a UCID, not a
// browsable directory of people.
export const metadata: Metadata = { robots: { index: false, follow: false } };

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  VALID: { label: "Valid", cls: "credit" },
  SUPERSEDED: { label: "Superseded by a newer certificate", cls: "pending" },
  REVOKED: { label: "Revoked", cls: "adjust" },
};

export default async function VerifyUcidPage({ params }: { params: Promise<{ ucid: string }> }) {
  const { ucid } = await params;
  const result = await verifyUcid(decodeURIComponent(ucid));

  if (!result) {
    return (
      <main className="page" style={{ maxWidth: 640 }}>
        <div className="pagehead">
          <div className="eyebrow">Certificate verification</div>
          <h1>Not found</h1>
          <p className="sub">
            No certificate carries the ID “{decodeURIComponent(ucid)}”. Check the UCID against the
            printed certificate and <Link href="/verify">try again</Link>.
          </p>
        </div>
      </main>
    );
  }

  const status = STATUS_STYLE[result.status];
  return (
    <main className="page" style={{ maxWidth: 640 }}>
      <div className="pagehead">
        <div className="eyebrow">Certificate verification</div>
        <h1 className="num">{result.ucid}</h1>
        <p className="sub">
          <span className={`badge ${status.cls}`}>{status.label}</span>
          {result.supersededByUcid && (
            <>
              {" "}
              — see <Link href={`/verify/${result.supersededByUcid}`} className="num">{result.supersededByUcid}</Link>
            </>
          )}
        </p>
      </div>
      <div className="card">
        <table className="grid" style={{ border: "none", boxShadow: "none" }}>
          <tbody>
            <Row k="Attendee">{result.attendeeName}</Row>
            <Row k="Event">
              {result.eventName} · {fmtDateRange(result.eventStartsAt, result.eventEndsAt)}
            </Row>
            <Row k="Credit">
              {result.totals.map((t) => `${fmtUnits(t.units)} ${t.creditType}`).join(" · ")}
            </Row>
            <Row k="Issuing organization">{result.issuingOrganization}</Row>
            <Row k="Verification method">{result.verificationMethods.join("; ") || "—"}</Row>
            <Row k="Issued">{fmtDayShort(result.issuedAt)}</Row>
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--slate)", marginTop: 12 }}>
        This record derives from an append-only credit ledger. A certificate is never edited: when
        the underlying record changes, a new UCID supersedes this one, and both remain verifiable.
      </p>
    </main>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <tr>
      <td style={{ fontWeight: 600, width: 180, color: "var(--slate)" }}>{k}</td>
      <td>{children}</td>
    </tr>
  );
}
