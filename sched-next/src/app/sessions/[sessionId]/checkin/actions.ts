"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  bulkCheckIn,
  checkIn,
  undoCheckIn,
  type BulkCheckInSummary,
  type CheckInResult,
} from "@/lib/ledger";
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

export async function undoCheckInAction(
  sessionId: string,
  personId: string,
  reason: string,
): Promise<CheckInResult> {
  // Corrections stay admin-only: door staff record attendance; changing the
  // record's history is a different level of trust.
  const actor = await currentUser();
  if (!actor || !isAdmin(actor)) return { ok: false, error: "Only admins can correct check-ins." };
  const result = await undoCheckIn(sessionId, personId, reason, actor.id);
  if (result.ok) revalidatePath(`/sessions/${sessionId}`);
  return result;
}
