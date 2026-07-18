import { db } from "./db";

// Org-level compliance views, derived from the ledger.

// One normalized row shape feeds every export preset: person x event, units
// netted (adjustments carry negative units, so corrected credit nets out).
export interface ExportRow {
  licenseId: string;
  lastName: string;
  firstName: string;
  provider: string;
  program: string;
  startDate: Date;
  endDate: Date;
  creditTypeName: string;
  units: number;
  ucid: string;
  verificationMethod: string;
}

export async function buildExportRows(
  orgId: string,
  creditTypeId: string,
  from?: Date,
  to?: Date,
): Promise<{ org: { name: string }; creditType: { name: string }; rows: ExportRow[] } | null> {
  const org = await db.organization.findUnique({ where: { id: orgId } });
  const creditType = await db.creditType.findFirst({ where: { id: creditTypeId, orgId } });
  if (!org || !creditType) return null;

  const records = await db.creditRecord.findMany({
    where: {
      creditTypeId,
      person: { orgId },
      ...(from || to
        ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
    },
    include: {
      person: { select: { id: true, name: true, licenseId: true } },
      event: { select: { id: true, name: true, startsAt: true, endsAt: true } },
    },
  });

  const byKey = new Map<string, ExportRow & { personId: string; eventId: string }>();
  for (const r of records) {
    if (!r.event) continue;
    const key = `${r.personId}|${r.event.id}`;
    const [first, ...rest] = r.person.name.split(" ");
    const e = byKey.get(key) ?? {
      personId: r.personId,
      eventId: r.event.id,
      licenseId: r.person.licenseId ?? "",
      lastName: rest.join(" "),
      firstName: first,
      provider: org.name,
      program: r.event.name,
      startDate: r.event.startsAt,
      endDate: r.event.endsAt,
      creditTypeName: creditType.name,
      units: 0,
      ucid: "",
      verificationMethod: "Verified Attendance via Check-In",
    };
    e.units = Math.round((e.units + r.units) * 10000) / 10000;
    byKey.set(key, e);
  }

  const rows = [...byKey.values()].filter((e) => e.units > 0);
  // Attach the current VALID certificate UCID where one has been issued.
  const issues = await db.certificateIssue.findMany({
    where: { status: "VALID", personId: { in: [...new Set(rows.map((r) => r.personId))] } },
    select: { personId: true, eventId: true, ucid: true },
  });
  const ucidByKey = new Map(issues.map((i) => [`${i.personId}|${i.eventId}`, i.ucid]));
  for (const r of rows) r.ucid = ucidByKey.get(`${r.personId}|${r.eventId}`) ?? "";

  rows.sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
  return { org, creditType, rows };
}

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
