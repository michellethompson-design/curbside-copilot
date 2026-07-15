import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getPersonTranscript } from "@/lib/transcript";
import { fmtDayShort, fmtUnits } from "@/lib/format";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";

// Styled like an official document because it is one: this page gets printed
// and handed to principals and accreditors.
export default async function TranscriptPage({
  params,
  searchParams,
}: {
  params: Promise<{ personId: string }>;
  searchParams: Promise<{ year?: string; creditTypeId?: string }>;
}) {
  const { personId } = await params;
  const sp = await searchParams;
  const year = sp.year && sp.year !== "all" ? Number(sp.year) : undefined;
  const creditTypeId = sp.creditTypeId && sp.creditTypeId !== "all" ? sp.creditTypeId : undefined;

  const [transcript, allYears, creditTypes] = await Promise.all([
    getPersonTranscript(personId, { year, creditTypeId }),
    getPersonTranscript(personId).then((t) => t?.years ?? []),
    db.creditType.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!transcript) notFound();

  return (
    <main className="page transcript-doc">
      <form method="get" className="filters no-print" aria-label="Filter transcript">
        <label htmlFor="t-year">Year</label>
        <select id="t-year" name="year" defaultValue={sp.year ?? "all"}>
          <option value="all">All years</option>
          {allYears.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <label htmlFor="t-type">Credit type</label>
        <select id="t-type" name="creditTypeId" defaultValue={sp.creditTypeId ?? "all"}>
          <option value="all">All types</option>
          {creditTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button type="submit">Apply</button>
        <PrintButton />
      </form>

      <header className="doc-head">
        <div className="doc-org">{transcript.person.org}</div>
        <h1>Professional Development Transcript</h1>
        <dl className="doc-meta">
          <div>
            <dt>Educator</dt>
            <dd>{transcript.person.name}</dd>
          </div>
          <div>
            <dt>Professional ID</dt>
            <dd className="num">{transcript.person.licenseId ?? "—"}</dd>
          </div>
          <div>
            <dt>Scope</dt>
            <dd>
              {year ? `Calendar year ${year}` : "All years on record"}
              {creditTypeId
                ? ` · ${creditTypes.find((t) => t.id === creditTypeId)?.name}`
                : " · all credit types"}
            </dd>
          </div>
          <div>
            <dt>Issued</dt>
            <dd>{fmtDayShort(new Date())}</dd>
          </div>
        </dl>
      </header>

      <table className="grid doc-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Event</th>
            <th>Session</th>
            <th>Credit type</th>
            <th className="num">Units</th>
          </tr>
        </thead>
        <tbody>
          {transcript.entries.map((e) => (
            <tr key={e.id} className={e.kind === "ADJUSTMENT" ? "adjust-row" : undefined}>
              <td className="num">{fmtDayShort(e.earnedAt)}</td>
              <td>{e.eventName}</td>
              <td>
                {e.sessionTitle}
                {e.kind === "ADJUSTMENT" && (
                  <div className="reason">
                    Correction: {e.reason} ({fmtDayShort(e.recordedAt)})
                  </div>
                )}
              </td>
              <td>{e.creditType}</td>
              <td className="num">{e.units < 0 ? `−${fmtUnits(-e.units)}` : fmtUnits(e.units)}</td>
            </tr>
          ))}
          {transcript.entries.length === 0 && (
            <tr>
              <td colSpan={5} style={{ color: "var(--slate)" }}>
                No credit on record for this scope.
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          {transcript.totals.map((t) => (
            <tr key={t.creditType}>
              <td colSpan={4} className="total-label">
                Total {t.creditType}
              </td>
              <td className="num total-units">{fmtUnits(t.units)}</td>
            </tr>
          ))}
        </tfoot>
      </table>

      <footer className="doc-foot">
        Derived from the district&rsquo;s append-only credit ledger
        {" "}— every figure above traces to attendance records and dated correction entries. Nothing on
        this transcript can be silently edited.
      </footer>
    </main>
  );
}
