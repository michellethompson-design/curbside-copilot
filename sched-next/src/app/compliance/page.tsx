import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { currentUser, isAdmin } from "@/lib/demo-user";
import { findPeopleMissingCredits, getComplianceReport } from "@/lib/compliance";
import { getPreset, PRESETS } from "@/lib/presets";
import { fmtUnits } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CompliancePage({
  searchParams,
}: {
  searchParams: Promise<{ creditTypeId?: string; from?: string; to?: string; threshold?: string; q?: string; preset?: string }>;
}) {
  const user = await currentUser();
  if (!isAdmin(user)) redirect("/");
  const sp = await searchParams;

  const org = await db.organization.findFirstOrThrow();
  const creditTypes = await db.creditType.findMany({ where: { orgId: org.id }, orderBy: { name: "asc" } });
  const creditTypeId = sp.creditTypeId ?? creditTypes.find((t) => t.name.includes("Act 48"))?.id ?? creditTypes[0].id;
  const threshold = Number(sp.threshold ?? 6);
  const from = sp.from ? new Date(sp.from) : undefined;
  const to = sp.to ? new Date(sp.to) : undefined;

  const [report, missing] = await Promise.all([
    getComplianceReport(org.id, { creditTypeId, from, to }),
    findPeopleMissingCredits(org.id, creditTypeId, threshold, from, to),
  ]);
  if (!report || !missing) redirect("/compliance");

  const q = (sp.q ?? "").toLowerCase();
  const rows = q
    ? report.rows.filter((r) => r.name.toLowerCase().includes(q) || (r.licenseId ?? "").includes(q))
    : report.rows;

  const preset = getPreset(sp.preset);
  const exportUrl =
    `/api/orgs/${org.id}/compliance/export?creditTypeId=${creditTypeId}&preset=${preset.id}` +
    (sp.from ? `&from=${sp.from}` : "") +
    (sp.to ? `&to=${sp.to}` : "");

  return (
    <main className="page wide">
      <div className="pagehead">
        <div className="eyebrow">{org.name} · Compliance</div>
        <h1>Credit compliance</h1>
        <p className="sub">
          Who earned what, derived live from the ledger, and the registry-shaped export that goes to
          the state. The export mirrors an Act 48/PERMS upload (column format mocked for the
          prototype) — the point is that what Dana reports is what Sched already has.
        </p>
      </div>

      <form method="get" className="filters" aria-label="Compliance filters">
        <label htmlFor="c-type">Credit type</label>
        <select id="c-type" name="creditTypeId" defaultValue={creditTypeId}>
          {creditTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <label htmlFor="c-from">From</label>
        <input id="c-from" type="text" name="from" placeholder="2025-07-01" defaultValue={sp.from ?? ""} style={{ width: 110 }} />
        <label htmlFor="c-to">To</label>
        <input id="c-to" type="text" name="to" placeholder="2026-06-30" defaultValue={sp.to ?? ""} style={{ width: 110 }} />
        <label htmlFor="c-threshold">Threshold</label>
        <input id="c-threshold" type="text" name="threshold" defaultValue={String(threshold)} style={{ width: 60 }} className="num" />
        <label htmlFor="c-q">Find person</label>
        <input id="c-q" type="search" name="q" defaultValue={sp.q ?? ""} placeholder="Name or PPID" />
        <label htmlFor="c-preset">Export preset</label>
        <select id="c-preset" name="preset" defaultValue={preset.id}>
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button type="submit">Apply</button>
        <a className="btn primary" href={exportUrl} download>
          Download CSV
        </a>
      </form>
      <p style={{ margin: "-8px 0 18px", fontSize: 12.5, color: "var(--slate)" }}>
        <strong>{preset.name}</strong> — {preset.note}
        <br />
        Columns: <span className="num">{preset.columns.map((c) => c.header).join(" · ")}</span>
      </p>

      <section className="card" style={{ marginBottom: 20, borderLeft: "3px solid var(--amber)" }} aria-label="Below threshold">
        <h2 style={{ marginBottom: 6 }}>
          Below {fmtUnits(threshold)} {report.creditType.unit} of {report.creditType.name}
          {sp.from || sp.to ? " in range" : ""}
        </h2>
        <p style={{ margin: "0 0 10px", color: "var(--slate)", fontSize: 13.5 }}>
          <strong className="num">{missing.below.length.toLocaleString()}</strong> of{" "}
          <span className="num">{(report.rows.length + missing.below.filter((b) => b.eventCount === 0).length).toLocaleString()}</span>{" "}
          people are short. The same question is one sentence in Claude via the MCP server.
        </p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {missing.below.slice(0, 12).map((p) => (
            <Link key={p.personId} href={`/people/${p.personId}/transcript`} className="badge pending" style={{ textDecoration: "none" }}>
              {p.name} · needs {fmtUnits(p.shortfall)}
            </Link>
          ))}
          {missing.below.length > 12 && (
            <span className="badge pending num">+{(missing.below.length - 12).toLocaleString()} more</span>
          )}
        </div>
      </section>

      <table className="grid">
        <thead>
          <tr>
            <th>Person</th>
            <th>PPID</th>
            <th className="num">Events</th>
            <th className="num">{report.creditType.name}</th>
            <th>Standing</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 50).map((r) => (
            <tr key={r.personId}>
              <td>
                <Link href={`/people/${r.personId}/transcript`} style={{ fontWeight: 600 }}>
                  {r.name}
                </Link>
              </td>
              <td className="num" style={{ color: "var(--slate)" }}>{r.licenseId}</td>
              <td className="num">{r.eventCount}</td>
              <td className="num" style={{ fontWeight: 600 }}>{fmtUnits(r.units)}</td>
              <td>
                {r.units >= threshold ? (
                  <span className="badge credit">On track</span>
                ) : (
                  <span className="badge pending num">Needs {fmtUnits(threshold - r.units)}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 50 && (
        <p style={{ fontSize: 12.5, color: "var(--slate)" }}>
          Showing 50 of <span className="num">{rows.length.toLocaleString()}</span> — narrow with the
          search box, or take the CSV for the full set.
        </p>
      )}
    </main>
  );
}
