"use server";

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/demo-user";
import { resubmitClaim, submitClaim } from "@/lib/claims";

const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;
const EVIDENCE_TYPES = new Set(["application/pdf", "image/png", "image/jpeg"]);

async function storeEvidence(file: File | null): Promise<{ path: string; name: string } | { error: string } | null> {
  if (!file || file.size === 0) return null;
  if (file.size > MAX_EVIDENCE_BYTES) return { error: "Evidence must be under 5 MB." };
  if (!EVIDENCE_TYPES.has(file.type)) return { error: "Evidence must be a PDF, PNG, or JPEG." };
  const dir = path.join(process.cwd(), "uploads", "claims");
  mkdirSync(dir, { recursive: true });
  const safe = file.name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-80);
  const stored = path.join(dir, `${Date.now()}-${safe}`);
  writeFileSync(stored, Buffer.from(await file.arrayBuffer()));
  return { path: stored, name: file.name };
}

export async function submitClaimAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const user = await currentUser();
  if (!user) return { ok: false, error: "Sign in first." };

  const evidence = await storeEvidence(formData.get("evidence") as File | null);
  if (evidence && "error" in evidence) return { ok: false, error: evidence.error };

  // Anchor the date at noon UTC so it displays as the same calendar day in
  // US timezones (midnight-UTC dates rendered in ET showed the prior day).
  const dateRaw = String(formData.get("activityDate") ?? "").trim();
  const activityDate = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? new Date(`${dateRaw}T12:00:00Z`) : new Date(NaN);
  if (Number.isNaN(activityDate.getTime())) return { ok: false, error: "Pick the activity date as YYYY-MM-DD." };

  const result = await submitClaim({
    personId: user.id,
    orgId: user.orgId,
    creditTypeId: String(formData.get("creditTypeId") ?? ""),
    title: String(formData.get("title") ?? ""),
    provider: String(formData.get("provider") ?? ""),
    activityDate,
    unitsRequested: Number(formData.get("unitsRequested")),
    note: String(formData.get("note") ?? ""),
    ...(evidence ? { evidencePath: evidence.path, evidenceName: evidence.name } : {}),
  });
  revalidatePath("/me/claims");
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function resubmitClaimAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const user = await currentUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const evidence = await storeEvidence(formData.get("evidence") as File | null);
  if (evidence && "error" in evidence) return { ok: false, error: evidence.error };
  const result = await resubmitClaim(
    String(formData.get("claimId") ?? ""),
    user.id,
    String(formData.get("note") ?? ""),
    evidence ?? undefined,
  );
  revalidatePath("/me/claims");
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}
