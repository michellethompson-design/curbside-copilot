"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  bulkCheckIn,
  checkIn,
  type BulkCheckInSummary,
  type CheckInResult,
} from "@/lib/ledger";
import { requestCorrection } from "@/lib/corrections";
import { canCheckIn, currentUser, isAdmin } from "@/lib/demo-user";

async function authorize(sessionId: string) {
  const [actor, session] = await Promise.all([
    currentUser(),
    db.session.findUnique({ where: { id: sessionId }, select: { eventId: true } }),
  ]);
  if (!session) return { actor: null, error: "Session not found." };
  if (!actor || !canCheckIn(actor, session.eventId)) {
    return { actor: null, error: "Only admins or this event's door staff can run check-in." };
  }
  return { actor, error: null };
}

export async function checkInAction(sessionId: string, personId: string): Promise<CheckInResult> {
  const { actor, error } = await authorize(sessionId);
  if (!actor) return { ok: false, error: error! };
  const result = await checkIn(sessionId, personId, actor.id, "ROSTER");
  if (result.ok) revalidatePath(`/sessions/${sessionId}`);
  return result;
}

export async function bulkCheckInAction(
  sessionId: string,
  personIds: string[],
): Promise<BulkCheckInSummary | { error: string }> {
  const { actor, error } = await authorize(sessionId);
  if (!actor) return { error: error! };
  const summary = await bulkCheckIn(sessionId, personIds.slice(0, 200), actor.id);
  revalidatePath(`/sessions/${sessionId}`);
  return summary;
}

export async function requestCorrectionAction(
  sessionId: string,
  personId: string,
  reasonCode: string,
  reason: string,
): Promise<CheckInResult> {
  // Corrections are two-person: an admin requests here; a different admin
  // approves on /approvals, which is what executes the offsetting entries.
  // Door staff record attendance; touching the record's history is a
  // different level of trust.
  const actor = await currentUser();
  if (!actor || !isAdmin(actor)) return { ok: false, error: "Only admins can request corrections." };
  const result = await requestCorrection(sessionId, personId, actor.id, reasonCode, reason);
  if (result.ok) {
    revalidatePath(`/sessions/${sessionId}`);
    return { ok: true, awarded: [] };
  }
  return result;
}
