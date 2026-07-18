"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { transitionClaim } from "@/lib/claims";
import { decideCorrection } from "@/lib/corrections";
import { currentUser, isAdmin } from "@/lib/demo-user";

export async function claimAction(formData: FormData) {
  const user = await currentUser();
  if (!isAdmin(user)) return;
  const toStatus = String(formData.get("toStatus")) as
    | "UNDER_REVIEW"
    | "APPROVED"
    | "REJECTED"
    | "CHANGES_REQUESTED";
  const claimId = String(formData.get("claimId"));
  const unitsRaw = formData.get("unitsApproved");
  const units = unitsRaw ? Number(unitsRaw) : undefined;
  const result = await transitionClaim(claimId, user!.id, toStatus, String(formData.get("note") ?? ""), units);
  revalidatePath("/approvals");
  if (!result.ok) {
    redirect(`/approvals?note=${encodeURIComponent(result.error)}`);
  }
  if (toStatus === "APPROVED") {
    const claim = await db.claim.findUnique({ where: { id: claimId }, include: { person: true, creditType: true } });
    redirect(
      `/approvals?note=${encodeURIComponent(
        `Approved — ${units ?? claim?.unitsRequested} ${claim?.creditType.name} written to ${claim?.person.name}'s ledger.`,
      )}`,
    );
  }
}

export async function correctionAction(formData: FormData) {
  const user = await currentUser();
  if (!isAdmin(user)) return;
  await decideCorrection(
    String(formData.get("requestId")),
    user!.id,
    formData.get("decision") === "approve",
    String(formData.get("note") ?? ""),
  );
  revalidatePath("/approvals");
}
