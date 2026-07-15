import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { fmtDateRange, fmtDayShort, fmtUnits } from "@/lib/format";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";

// Completion certificate, self-serve and re-downloadable forever. People lose
// certificates constantly and email staff for reissues; this page is the
// reissue. Print it or save as PDF from the print dialog.
export default async function CertificatePage({
  params,
}: {
  params: Promise<{ personId: string; eventId: string }>;
}) {
  const { personId, eventId } = await params;
  const [person, event, records] = await Promise.all([
    db.person.findUnique({ where: { id: personId }, include: { org: true } }),
    db.event.findUnique({ where: { id: eventId } }),
    db.creditRecord.findMany({
      where: { personId, eventId },
      include: { creditType: true },
    }),
  ]);
  if (!person || !event) notFound();

  const totals = new Map<string, { name: string; unit: string; units: number }>();
  for (const r of records) {
    const t = totals.get(r.creditTypeId) ?? { name: r.creditType.name, unit: r.creditType.unit, units: 0 };
    t.units = Math.round((t.units + r.units) * 10000) / 10000;
    totals.set(r.creditTypeId, t);
  }
  const earned = [...totals.values()].filter((t) => t.units > 0);
  const sessionCount = new Set(records.filter((r) => r.units > 0).map((r) => r.sessionId)).size;

  if (earned.length === 0) {
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

  return (
    <main className="page cert-doc">
      <div className="no-print" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <PrintButton label="Print / save as PDF" />
      </div>
      <div className="cert-frame">
        <div className="doc-org">{person.org.name}</div>
        <div className="cert-title">Certificate of Completion</div>
        <p className="cert-line">This certifies that</p>
        <div className="cert-name">{person.name}</div>
        {person.licenseId && <div className="cert-ppid num">Professional ID {person.licenseId}</div>}
        <p className="cert-line">
          completed {sessionCount} session{sessionCount === 1 ? "" : "s"} of professional development at
        </p>
        <div className="cert-event">{event.name}</div>
        <div className="cert-dates">{fmtDateRange(event.startsAt, event.endsAt)} · {event.venue}</div>
        <div className="cert-credits">
          {earned.map((t) => (
            <div key={t.name} className="cert-credit">
              <span className="num">{fmtUnits(t.units)}</span> {t.name}
            </div>
          ))}
        </div>
        <div className="cert-footer">
          <div>
            <div className="cert-sig">{person.org.name}</div>
            <div className="cert-sig-label">Issuing organization</div>
          </div>
          <div>
            <div className="cert-sig num">{fmtDayShort(new Date())}</div>
            <div className="cert-sig-label">Reissued from the credit ledger</div>
          </div>
        </div>
      </div>
    </main>
  );
}
