"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { currentUser, isAdmin } from "@/lib/demo-user";

// Review-queue actions for fetcher-landed CANDIDATE entries. Accepting makes
// an entry STATE_CANONICAL — live for planners to attach to sessions.
// Dismissing deletes it, but only while nothing references it; a credit type
// with sessions or ledger entries behind it can no longer simply vanish.

export async function acceptCandidate(creditTypeId: string) {
  const user = await currentUser();
  if (!isAdmin(user)) return;
  await db.creditType.update({
    where: { id: creditTypeId },
    data: { status: "STATE_CANONICAL" },
  });
  revalidatePath("/settings/credit-types");
}

export async function dismissCandidate(creditTypeId: string) {
  const user = await currentUser();
  if (!isAdmin(user)) return;
  const refs = await db.creditType.findUnique({
    where: { id: creditTypeId },
    include: { _count: { select: { sessionCredits: true, creditRecords: true } } },
  });
  if (!refs || refs.status !== "CANDIDATE") return;
  if (refs._count.sessionCredits > 0 || refs._count.creditRecords > 0) return;
  await db.creditTypeAuthorization.deleteMany({ where: { creditTypeId } });
  await db.creditType.delete({ where: { id: creditTypeId } });
  revalidatePath("/settings/credit-types");
}
