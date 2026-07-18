import { readFileSync } from "node:fs";
import { db } from "@/lib/db";
import { currentUser, isAdmin } from "@/lib/demo-user";

// Evidence is visible to its owner and to admins — never public.
export async function GET(_req: Request, { params }: { params: Promise<{ claimId: string }> }) {
  const { claimId } = await params;
  const [user, claim] = await Promise.all([
    currentUser(),
    db.claim.findUnique({ where: { id: claimId } }),
  ]);
  if (!claim?.evidencePath) return new Response("Not found", { status: 404 });
  if (!user || (user.id !== claim.personId && !isAdmin(user))) {
    return new Response("Forbidden", { status: 403 });
  }
  try {
    const bytes = readFileSync(claim.evidencePath);
    const type = claim.evidencePath.endsWith(".pdf")
      ? "application/pdf"
      : claim.evidencePath.endsWith(".png")
        ? "image/png"
        : "image/jpeg";
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": type,
        "Content-Disposition": `inline; filename="${(claim.evidenceName ?? "evidence").replace(/"/g, "")}"`,
      },
    });
  } catch {
    return new Response("Evidence file missing on disk", { status: 410 });
  }
}
