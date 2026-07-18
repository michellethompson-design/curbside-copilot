import { Prisma } from "@prisma/client";
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
    include: {
      credits: { include: { creditType: { include: { authorizations: true } } } },
    },
  });
  if (!session) return { ok: false, error: "Session not found." };

  // Role-gated grant authority (P0): a credit type carrying authorizations
  // can only be granted by an actor holding one of the required roles, scoped
  // to this event or org-wide. No admin bypass — that is the entire point of
  // the rule (Pasadena ISD rejected two products for enforcing it in UI only).
  const restricted = session.credits.filter((c) => c.creditType.authorizations.length > 0);
  // MVAR extension: when a restricted type is granted, the record names the
  // role that authorized the assignment (credit_type_authorization_role).
  const authRoleByType = new Map<string, string>();
  if (restricted.length > 0) {
    const actorRoles = await db.role.findMany({ where: { personId: recordedById } });
    for (const c of restricted) {
      const required = c.creditType.authorizations.map((a) => a.requiredRole);
      const match = actorRoles.find(
        (r) => required.includes(r.level) && (r.eventId === null || r.eventId === session.eventId),
      );
      if (match) authRoleByType.set(c.creditTypeId, match.level);
      const authorized = !!match;
      if (!authorized) {
        return {
          ok: false,
          error:
            `${c.creditType.name} can only be granted by ${required
              .map((x) => x.replace(/_/g, " ").toLowerCase())
              .join(" or ")} staff. Ask an authorized grantor to run this session's check-in.`,
        };
      }
    }
  }

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

  try {
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
            extensionsJson: authRoleByType.has(a.creditType.id)
              ? JSON.stringify({ credit_type_authorization_role: authRoleByType.get(a.creditType.id) })
              : null,
          },
        }),
      ),
    ]);
  } catch (e) {
    // Two door devices tapping the same person at the same instant: the
    // unique (sessionId, personId) constraint lets exactly one transaction
    // land. The loser gets the same friendly answer as a late tap — the
    // person is checked in, nothing double-awarded.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "Already checked in." };
    }
    throw e;
  }

  return { ok: true, awarded: awards.map((a) => ({ creditType: a.creditType.name, units: a.units })) };
}

export interface BulkCheckInSummary {
  checkedIn: number;
  skipped: { personId: string; error: string }[];
}

// Bulk is a loop over the single path on purpose: every person still gets an
// individual attendance row, individual ledger awards, and the overlap check.
// Bulk changes the number of taps, never the shape of the record.
export async function bulkCheckIn(
  sessionId: string,
  personIds: string[],
  recordedById: string,
): Promise<BulkCheckInSummary> {
  const summary: BulkCheckInSummary = { checkedIn: 0, skipped: [] };
  for (const personId of personIds) {
    const r = await checkIn(sessionId, personId, recordedById, "ROSTER");
    if (r.ok) summary.checkedIn++;
    else summary.skipped.push({ personId, error: r.error });
  }
  return summary;
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
