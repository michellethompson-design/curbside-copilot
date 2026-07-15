import { db } from "./db";

// Org-level compliance views, derived from the ledger.

export interface ComplianceFilters {
  creditTypeId: string;
  from?: Date;
  to?: Date;
}

export async function getComplianceReport(orgId: string, filters: ComplianceFilters) {
  const creditType = await db.creditType.findFirst({
    where: { id: filters.creditTypeId, orgId },
  });
  if (!creditType) return null;

  const records = await db.creditRecord.findMany({
    where: {
      creditTypeId: creditType.id,
      person: { orgId },
      ...(filters.from || filters.to
        ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
        : {}),
    },
    select: { personId: true, units: true, eventId: true },
  });

  const byPerson = new Map<string, { units: number; events: Set<string> }>();
  for (const r of records) {
    const e = byPerson.get(r.personId) ?? { units: 0, events: new Set() };
    e.units = Math.round((e.units + r.units) * 10000) / 10000;
    e.events.add(r.eventId);
    byPerson.set(r.personId, e);
  }

  const people = await db.person.findMany({
    where: { id: { in: [...byPerson.keys()] } },
    select: { id: true, name: true, email: true, licenseId: true },
  });
  const personById = new Map(people.map((p) => [p.id, p]));

  const rows = [...byPerson.entries()]
    .map(([personId, v]) => {
      const p = personById.get(personId)!;
      return {
        personId,
        name: p.name,
        email: p.email,
        licenseId: p.licenseId,
        units: v.units,
        eventCount: v.events.size,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    creditType: { id: creditType.id, name: creditType.name, unit: creditType.unit },
    rows,
    totalUnits: Math.round(rows.reduce((s, r) => s + r.units, 0) * 100) / 100,
  };
}

export async function findPeopleMissingCredits(
  orgId: string,
  creditTypeId: string,
  threshold: number,
  from?: Date,
  to?: Date,
) {
  const report = await getComplianceReport(orgId, { creditTypeId, from, to });
  if (!report) return null;

  // People with zero ledger entries in range are below threshold too — absence
  // from the ledger is the loudest missing-credits signal there is. Filtered
  // in memory: a `notIn` with a thousand ids overruns SQLite's parameter cap.
  const covered = new Set(report.rows.map((r) => r.personId));
  const uncovered = (
    await db.person.findMany({
      where: { orgId },
      select: { id: true, name: true, email: true, licenseId: true },
      orderBy: { name: "asc" },
    })
  ).filter((p) => !covered.has(p.id));

  const below = [
    ...report.rows
      .filter((r) => r.units < threshold)
      .map((r) => ({ ...r, shortfall: Math.round((threshold - r.units) * 100) / 100 })),
    ...uncovered.map((p) => ({
      personId: p.id,
      name: p.name,
      email: p.email,
      licenseId: p.licenseId,
      units: 0,
      eventCount: 0,
      shortfall: threshold,
    })),
  ].sort((a, b) => b.shortfall - a.shortfall || a.name.localeCompare(b.name));

  return { creditType: report.creditType, threshold, below };
}
