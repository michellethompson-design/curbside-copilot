import { db } from "./db";

// Organizer CRUD (P4). Bulk paste is idempotent per SPEC.md Stage 1: a line
// whose (title, start) already exists in the event is skipped, so re-pasting
// a corrected sheet never duplicates sessions.

/** UTC instant for a wall-clock time in America/New_York (EDT, UTC-4). */
export function easternWallTime(dateISO: string, hhmm: string): Date | null {
  const dm = dateISO.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const tm = hhmm.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!dm || !tm) return null;
  const hour = Number(tm[1]);
  const minute = Number(tm[2]);
  if (hour > 23 || minute > 59) return null;
  return new Date(Date.UTC(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), hour + 4, minute));
}

export async function createEvent(orgId: string, input: { name: string; venue: string; startISO: string; endISO: string }) {
  const startsAt = easternWallTime(input.startISO, "8:00");
  const endsAt = easternWallTime(input.endISO, "17:00");
  if (!input.name.trim() || !startsAt || !endsAt || endsAt < startsAt) return null;
  return db.event.create({
    data: { orgId, name: input.name.trim(), venue: input.venue.trim() || "TBD", startsAt, endsAt },
  });
}

export interface BulkAddSummary {
  created: number;
  skipped: number;
  errors: { line: number; message: string }[];
}

/**
 * One session per line, tab- or comma-separated:
 *   Title  Track  Room  2026-08-17  9:15  10:45  Speakers (optional)
 */
export async function bulkAddSessions(
  eventId: string,
  text: string,
  creditTypeIds: string[],
): Promise<BulkAddSummary> {
  const summary: BulkAddSummary = { created: 0, skipped: 0, errors: [] };
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const parts = (lines[i].includes("\t") ? lines[i].split("\t") : lines[i].split(",")).map((p) => p.trim());
    const [title, track, room, dateISO, startHHMM, endHHMM, speakers] = parts;
    if (!title || !dateISO || !startHHMM || !endHHMM) {
      summary.errors.push({ line: i + 1, message: "Need at least: title, track, room, date, start, end" });
      continue;
    }
    const startsAt = easternWallTime(dateISO, startHHMM);
    const endsAt = easternWallTime(dateISO, endHHMM);
    if (!startsAt || !endsAt || endsAt <= startsAt) {
      summary.errors.push({ line: i + 1, message: `Bad date/time: ${dateISO} ${startHHMM}–${endHHMM}` });
      continue;
    }
    const existing = await db.session.findFirst({ where: { eventId, title, startsAt } });
    if (existing) {
      summary.skipped++;
      continue;
    }
    const session = await db.session.create({
      data: {
        eventId,
        title,
        track: track || "General",
        room: room || "TBD",
        speakers: speakers ?? "",
        startsAt,
        endsAt,
      },
    });
    for (const creditTypeId of creditTypeIds) {
      await db.sessionCredit.create({ data: { sessionId: session.id, creditTypeId } });
    }
    summary.created++;
  }

  // Widen the event window if pasted sessions fall outside it.
  const bounds = await db.session.aggregate({
    where: { eventId },
    _min: { startsAt: true },
    _max: { endsAt: true },
  });
  if (bounds._min.startsAt && bounds._max.endsAt) {
    await db.event.update({
      where: { id: eventId },
      data: { startsAt: bounds._min.startsAt, endsAt: bounds._max.endsAt },
    });
  }
  return summary;
}

/** Delete a session only while nothing depends on it. */
export async function deleteSessionIfEmpty(sessionId: string): Promise<{ ok: boolean; error?: string }> {
  const counts = await db.session.findUnique({
    where: { id: sessionId },
    include: { _count: { select: { attendance: true, agendaItems: true } } },
  });
  if (!counts) return { ok: false, error: "Not found" };
  const ledger = await db.creditRecord.count({ where: { sessionId } });
  if (counts._count.attendance > 0 || ledger > 0) {
    return { ok: false, error: "This session has attendance or ledger entries — it can no longer be deleted." };
  }
  await db.$transaction([
    db.agendaItem.deleteMany({ where: { sessionId } }),
    db.sessionCredit.deleteMany({ where: { sessionId } }),
    db.session.delete({ where: { id: sessionId } }),
  ]);
  return { ok: true };
}
