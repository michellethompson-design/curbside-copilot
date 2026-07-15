"use server";

import { revalidatePath } from "next/cache";
import { checkIn, undoCheckIn, type CheckInResult } from "@/lib/ledger";
import { currentUser, isAdmin } from "@/lib/demo-user";

export async function checkInAction(sessionId: string, personId: string): Promise<CheckInResult> {
  const actor = await currentUser();
  if (!actor || !isAdmin(actor)) return { ok: false, error: "Only admins can run roster check-in." };
  const result = await checkIn(sessionId, personId, actor.id, "ROSTER");
  if (result.ok) revalidatePath(`/sessions/${sessionId}`);
  return result;
}

export async function undoCheckInAction(
  sessionId: string,
  personId: string,
  reason: string,
): Promise<CheckInResult> {
  const actor = await currentUser();
  if (!actor || !isAdmin(actor)) return { ok: false, error: "Only admins can correct check-ins." };
  const result = await undoCheckIn(sessionId, personId, reason, actor.id);
  if (result.ok) revalidatePath(`/sessions/${sessionId}`);
  return result;
}
