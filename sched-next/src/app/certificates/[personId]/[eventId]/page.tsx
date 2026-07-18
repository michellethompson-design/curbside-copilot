import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ensureCertificate, type CertTotals } from "@/lib/certificates";
import { fmtDateRange, fmtDayShort, fmtUnits } from "@/lib/format";
import { PrintButton } from "@/components/PrintButton";
import { Seal } from "@/components/Seal";

export const dynamic = "force-dynamic";

// Completion certificate, self-serve and re-downloadable forever. Reloading
// re-issues automatically if the ledger changed — a corrected record quietly
// supersedes the old paper, and every UCID ever printed stays verifiable.
export default async function CertificatePage({
  params,
}: {
  params: Promise<{ personId: string; eventId: string }>;
}) {
  const { personId, eventId } = await params;
  const [person, event] = await Promise.all([
    db.person.findUnique({ where: { id: personId }, include: { org: true } }),
    db.event.findUnique({ where: { id: eventId } }),
  ]);
  if (!person || !event) notFound();

  const issue = await ensureCertificate(personId, eventId);
  if (!issue) {
    return (
      <main className="page">
        <h1>No certificate yet</h1>
        <p className="sub">
          {person.name} has no credit on the ledger for {event.name}. Certificates issue from
          attendance — check in first.
        </p>
      </main>
    );
  }
  const earned = JSON.parse(issue.totalsJson) as CertTotals[];

  return (
    <main className="page cert-doc">
      <div className="no-print" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <PrintButton label="Print / save as PDF" />
      </div>
      <div className="cert-frame">
        <div className="doc-org">{person.org.name}</div>
        <div className="cert-title">Certificate of Completion</div>
        <p className="cert-line">This certifies that</p>
        <div className="cert-name">{issue.personName}</div>
        {issue.licenseId && <div className="cert-ppid num">Professional ID {issue.licenseId}</div>}
        <p className="cert-line">
          completed {issue.sessionCount} session{issue.sessionCount === 1 ? "" : "s"} of professional development at
        </p>
        <div className="cert-event">{issue.eventName}</div>
        <div className="cert-dates">
          {fmtDateRange(issue.eventStartsAt, issue.eventEndsAt)} · {event.venue}
        </div>
        <div className="cert-credits">
          {earned.map((t) => (
            <div key={t.creditType} className="cert-credit">
              <span className="num">{fmtUnits(t.units)}</span> {t.creditType}
            </div>
          ))}
        </div>
        <div className="cert-seal">
          <Seal variant="foil" size={108} />
        </div>
        <div className="cert-footer">
          <div>
            <div className="cert-sig">{person.org.name}</div>
            <div className="cert-sig-label">Issuing organization</div>
          </div>
          <div>
            <div className="cert-sig num">{issue.ucid}</div>
            <div className="cert-sig-label">Verify at /verify · issued {fmtDayShort(issue.issuedAt)}</div>
          </div>
        </div>
      </div>
    </main>
  );
}
