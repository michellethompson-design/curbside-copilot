import { db } from "./db";
import { undoCheckIn } from "./ledger";

// Two-person corrections: witnessing a mistake and rewriting the record are
// separated. Any admin can request; a DIFFERENT admin approves, and the
// approval is what executes the offsetting entries.

export const REASON_CODES = [
  { code: "DUPLICATE_CHECKIN", label: "Duplicate check-in" },
  { code: "WRONG_PERSON", label: "Wrong person tapped" },
  { code: "LEFT_EARLY", label: "Left before session credit threshold" },
  { code: "DATA_ENTRY_ERROR", label: "Data entry error" },
  { code: "OTHER", label: "Other (explain)" },
] as const;

export type CorrectionResult = { ok: true } | { ok: false; error: string };

export async function requestCorrection(
  sessionId: string,
  personId: string,
  requestedById: string,
  reasonCode: string,
  reason: string,
): Promise<CorrectionResult> {
  if (!REASON_CODES.some((r) => r.code === reasonCode)) return { ok: false, error: "Pick a reason code." };
  if (reasonCode === "OTHER" && !reason.trim()) return { ok: false, error: "OTHER needs an explanation." };
  const attendance = await db.attendance.findUnique({
    where: { sessionId_personId: { sessionId, personId } },
  });
  if (!attendance) return { ok: false, error: "No check-in to correct." };
  const open = await db.correctionRequest.findFirst({
    where: { sessionId, personId, status: "PENDING" },
  });
  if (open) return { ok: false, error: "A correction is already pending for this check-in." };
  await db.correctionRequest.create({
    data: { sessionId, personId, requestedById, reasonCode, reason: reason.trim() },
  });
  return { ok: true };
}

export async function decideCorrection(
  requestId: string,
  decidedById: string,
  approve: boolean,
  decisionNote: string,
): Promise<CorrectionResult> {
  const request = await db.correctionRequest.findUnique({ where: { id: requestId } });
  if (!request || request.status !== "PENDING") return { ok: false, error: "No pending request." };
  if (request.requestedById === decidedById) {
    return { ok: false, error: "The requester cannot approve their own correction — a second admin must." };
  }

  if (approve) {
    const label = REASON_CODES.find((r) => r.code === request.reasonCode)?.label ?? request.reasonCode;
    const executed = await undoCheckIn(
      request.sessionId,
      request.personId,
      request.reason ? `${label}: ${request.reason}` : label,
      decidedById,
    );
    if (!executed.ok) return executed;
  }
  await db.correctionRequest.update({
    where: { id: requestId },
    data: {
      status: approve ? "APPROVED" : "REJECTED",
      decidedById,
      decisionNote: decisionNote.trim() || null,
      decidedAt: new Date(),
    },
  });
  return { ok: true };
}
