import { db } from "./db";
import { yearOf } from "./format";

// Transcripts are derived views over the ledger — never stored, never edited.

export interface TranscriptFilters {
  year?: number;
  creditTypeId?: string;
}

export async function getPersonTranscript(personId: string, filters: TranscriptFilters = {}) {
  const person = await db.person.findUnique({
    where: { id: personId },
    include: { org: true },
  });
  if (!person) return null;

  const records = await db.creditRecord.findMany({
    where: { personId, ...(filters.creditTypeId ? { creditTypeId: filters.creditTypeId } : {}) },
    orderBy: { createdAt: "asc" },
    include: {
      event: { select: { id: true, name: true, startsAt: true } },
      creditType: { select: { id: true, name: true, unit: true } },
    },
  });

  const sessionIds = [...new Set(records.map((r) => r.sessionId).filter((x): x is string => !!x))];
  const sessions = await db.session.findMany({
    where: { id: { in: sessionIds } },
    select: { id: true, title: true, startsAt: true, endsAt: true },
  });
  const sessionById = new Map(sessions.map((s) => [s.id, s]));

  const entries = records
    .map((r) => {
      const session = r.sessionId ? sessionById.get(r.sessionId) : undefined;
      const earnedAt = session?.startsAt ?? r.createdAt;
      return {
        id: r.id,
        eventId: r.event.id,
        eventName: r.event.name,
        sessionTitle: session?.title ?? "—",
        earnedAt,
        year: yearOf(earnedAt),
        creditTypeId: r.creditType.id,
        creditType: r.creditType.name,
        unit: r.creditType.unit,
        units: r.units,
        kind: r.kind,
        reason: r.reason,
        recordedAt: r.createdAt,
      };
    })
    .filter((e) => (filters.year ? e.year === filters.year : true));

  // Totals per credit type net of adjustments — the number the state sees.
  const totals = new Map<string, { creditType: string; unit: string; units: number }>();
  for (const e of entries) {
    const t = totals.get(e.creditTypeId) ?? { creditType: e.creditType, unit: e.unit, units: 0 };
    t.units = Math.round((t.units + e.units) * 10000) / 10000;
    totals.set(e.creditTypeId, t);
  }

  const years = [...new Set(entries.map((e) => e.year))].sort((a, b) => b - a);

  return {
    person: {
      id: person.id,
      name: person.name,
      email: person.email,
      licenseId: person.licenseId,
      org: person.org.name,
    },
    entries,
    totals: [...totals.values()],
    years,
  };
}
