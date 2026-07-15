import { db } from "./db";
import { minutesToUnits, sessionMinutes, type RoundingMode } from "./credit-math";

// The only write paths to the credit ledger. Attendance is operational data
// and may be corrected in place; CreditRecord is the auditable record and only
// ever grows. A wrong award is fixed by an offsetting ADJUSTMENT with a
// reason, never by editing history — the auditor is a user.

export type CheckInResult =
  | { ok: true; awarded: { creditType: string; units: number }[] }
  | { ok: false; error: string };

export async function checkIn(
  sessionId: string,
  personId: string,
  recordedById: string,
  method: "ROSTER" | "SELF" | "QR" = "ROSTER",
): Promise<CheckInResult> {
  const session = await db.session.findUnique({
    where: { id: sessionId },
    include: { credits: { include: { creditType: true } } },
  });
  if (!session) return { ok: false, error: "Session not found." };

  const existing = await db.attendance.findUnique({
    where: { sessionId_personId: { sessionId, personId } },
  });
  if (existing) return { ok: false, error: "Already checked in." };

  // Concurrency rule (SPEC.md Stage 2): no verified attendance in two
  // overlapping sessions. Retro check-in is allowed; the actor is recorded.
  const clash = await db.attendance.findFirst({
    where: {
      personId,
      session: {
        id: { not: sessionId },
        startsAt: { lt: session.endsAt },
        endsAt: { gt: session.startsAt },
      },
    },
    include: { session: { select: { title: true } } },
  });
  if (clash) {
    return {
      ok: false,
      error: `Overlaps existing check-in: “${clash.session.title}”. Undo that one first.`,
    };
  }

  const minutes = sessionMinutes(session.startsAt, session.endsAt);
  const awards = session.credits.map((c) => ({
    creditType: c.creditType,
    units:
      c.fixedUnits ??
      minutesToUnits(minutes, {
        minutesPerUnit: c.creditType.minutesPerUnit,
        incrementMinutes: c.creditType.incrementMinutes,
        mode: c.creditType.roundingMode as RoundingMode,
      }),
  }));

  await db.$transaction([
    db.attendance.create({
      data: { sessionId, personId, method, recordedById },
    }),
    ...awards.map((a) =>
      db.creditRecord.create({
        data: {
          personId,
          eventId: session.eventId,
          sessionId,
          creditTypeId: a.creditType.id,
          units: a.units,
          kind: "AWARD",
        },
      }),
    ),
  ]);

  return { ok: true, awarded: awards.map((a) => ({ creditType: a.creditType.name, units: a.units })) };
}

export async function undoCheckIn(
  sessionId: string,
  personId: string,
  reason: string,
  _actorId: string,
): Promise<CheckInResult> {
  if (!reason.trim()) return { ok: false, error: "A correction needs a reason." };

  const attendance = await db.attendance.findUnique({
    where: { sessionId_personId: { sessionId, personId } },
  });
  if (!attendance) return { ok: false, error: "No check-in to undo." };

  // Net outstanding awards for this person x session, then offset them.
  const records = await db.creditRecord.findMany({ where: { personId, sessionId } });
  const offsetIds = new Set(records.filter((r) => r.offsetsId).map((r) => r.offsetsId));
  const open = records.filter((r) => r.kind === "AWARD" && !offsetIds.has(r.id));

  await db.$transaction([
    db.attendance.delete({ where: { id: attendance.id } }),
    ...open.map((r) =>
      db.creditRecord.create({
        data: {
          personId,
          eventId: r.eventId,
          sessionId,
          creditTypeId: r.creditTypeId,
          units: -r.units,
          kind: "ADJUSTMENT",
          reason: reason.trim(),
          offsetsId: r.id,
        },
      }),
    ),
  ]);

  return { ok: true, awarded: [] };
}
