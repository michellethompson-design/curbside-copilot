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
      claim: { select: { id: true, title: true, provider: true, activityDate: true } },
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
      const earnedAt = session?.startsAt ?? r.claim?.activityDate ?? r.createdAt;
      return {
        id: r.id,
        eventId: r.event?.id ?? null,
        eventName: r.event?.name ?? (r.claim ? `Off-platform · ${r.claim.provider}` : "—"),
        sessionTitle: session?.title ?? r.claim?.title ?? "—",
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
    .filter((e) => (filters.year ? e.year === filters.year : true))
    // Document order: when the credit was earned, then when it was recorded —
    // so a correction sits directly under the entry it offsets.
    .sort((a, b) => a.earnedAt.getTime() - b.earnedAt.getTime() || a.recordedAt.getTime() - b.recordedAt.getTime());

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
