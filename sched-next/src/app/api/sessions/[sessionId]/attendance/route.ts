import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Live attendance for a session. The roster screens poll this so every door
// device converges on the same truth within a few seconds.
export async function GET(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const rows = await db.attendance.findMany({
    where: { sessionId },
    select: { personId: true },
  });
  return NextResponse.json({ count: rows.length, personIds: rows.map((r) => r.personId) });
}
