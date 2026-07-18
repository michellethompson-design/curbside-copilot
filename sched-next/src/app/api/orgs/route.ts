import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const orgs = await db.organization.findMany({
    select: { id: true, name: true, _count: { select: { events: true, people: true } } },
  });
  return NextResponse.json({
    orgs: orgs.map((o) => ({ id: o.id, name: o.name, events: o._count.events, people: o._count.people })),
  });
}
