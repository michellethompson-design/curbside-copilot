import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const events = await db.event.findMany({
    where: { orgId },
    orderBy: { startsAt: "desc" },
    include: { _count: { select: { sessions: true } } },
  });
  return NextResponse.json({
    events: events.map((e) => ({
      id: e.id,
      name: e.name,
      venue: e.venue,
      status: e.status,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      sessionCount: e._count.sessions,
    })),
  });
}
