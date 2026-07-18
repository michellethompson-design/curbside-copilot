"use server";

import { revalidatePath } from "next/cache";
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
  const unitsRaw = formData.get("unitsApproved");
  await transitionClaim(
    String(formData.get("claimId")),
    user!.id,
    toStatus,
    String(formData.get("note") ?? ""),
    unitsRaw ? Number(unitsRaw) : undefined,
  );
  revalidatePath("/approvals");
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
