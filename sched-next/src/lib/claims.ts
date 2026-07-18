import { db } from "./db";

// Off-platform claims: the CFP-modeled submit / review / approve workflow.
// The state machine is small and explicit; every transition writes an
// append-only ClaimEvent, and approval writes the ledger AWARD in the same
// transaction so a claim can never be "approved" without its credit landing.

export const CLAIM_TRANSITIONS: Record<string, string[]> = {
  SUBMITTED: ["UNDER_REVIEW", "APPROVED", "REJECTED", "CHANGES_REQUESTED"],
  UNDER_REVIEW: ["APPROVED", "REJECTED", "CHANGES_REQUESTED"],
  CHANGES_REQUESTED: ["SUBMITTED"],
  APPROVED: [],
  REJECTED: [],
};

export const CLAIM_STATUS_LABEL: Record<string, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  CHANGES_REQUESTED: "Changes requested",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export type ClaimResult = { ok: true } | { ok: false; error: string };

export async function submitClaim(input: {
  personId: string;
  orgId: string;
  creditTypeId: string;
  title: string;
  provider: string;
  activityDate: Date;
  unitsRequested: number;
  note: string;
  evidencePath?: string;
  evidenceName?: string;
}): Promise<ClaimResult> {
  if (!input.title.trim() || !input.provider.trim()) return { ok: false, error: "Title and provider are required." };
  if (!(input.unitsRequested > 0)) return { ok: false, error: "Requested units must be positive." };
  const claim = await db.claim.create({ data: { ...input, status: "SUBMITTED" } });
  await db.claimEvent.create({
    data: { claimId: claim.id, actorId: input.personId, fromStatus: "—", toStatus: "SUBMITTED" },
  });
  return { ok: true };
}

export async function resubmitClaim(
  claimId: string,
  personId: string,
  note: string,
  evidence?: { path: string; name: string },
): Promise<ClaimResult> {
  const claim = await db.claim.findUnique({ where: { id: claimId } });
  if (!claim || claim.personId !== personId) return { ok: false, error: "Not your claim." };
  if (claim.status !== "CHANGES_REQUESTED") return { ok: false, error: "Only claims needing changes can be resubmitted." };
  await db.$transaction([
    db.claim.update({
      where: { id: claimId },
      data: {
        status: "SUBMITTED",
        note,
        ...(evidence ? { evidencePath: evidence.path, evidenceName: evidence.name } : {}),
      },
    }),
    db.claimEvent.create({
      data: { claimId, actorId: personId, fromStatus: "CHANGES_REQUESTED", toStatus: "SUBMITTED", note },
    }),
  ]);
  return { ok: true };
}

export async function transitionClaim(
  claimId: string,
  actorId: string,
  toStatus: "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "CHANGES_REQUESTED",
  note: string,
  unitsApproved?: number,
): Promise<ClaimResult> {
  const claim = await db.claim.findUnique({ where: { id: claimId }, include: { creditType: true } });
  if (!claim) return { ok: false, error: "Claim not found." };
  if (!CLAIM_TRANSITIONS[claim.status]?.includes(toStatus)) {
    return { ok: false, error: `A ${CLAIM_STATUS_LABEL[claim.status]?.toLowerCase()} claim cannot move to ${CLAIM_STATUS_LABEL[toStatus]?.toLowerCase()}.` };
  }
  if ((toStatus === "REJECTED" || toStatus === "CHANGES_REQUESTED") && !note.trim()) {
    return { ok: false, error: "A note is required when rejecting or requesting changes." };
  }

  const writes = [
    db.claim.update({ where: { id: claimId }, data: { status: toStatus } }),
    db.claimEvent.create({
      data: { claimId, actorId, fromStatus: claim.status, toStatus, note: note || null },
    }),
  ];
  if (toStatus === "APPROVED") {
    const units = unitsApproved ?? claim.unitsRequested;
    if (!(units > 0)) return { ok: false, error: "Approved units must be positive." };
    writes.push(
      db.creditRecord.create({
        data: {
          personId: claim.personId,
          eventId: null,
          claimId: claim.id,
          creditTypeId: claim.creditTypeId,
          units,
          kind: "AWARD",
          reason: `Off-platform: ${claim.title} (${claim.provider})`,
          extensionsJson: JSON.stringify({ evidence_of_attendance: "self_reported_admin_approved" }),
        },
      }) as never,
    );
  }
  await db.$transaction(writes);
  return { ok: true };
}
