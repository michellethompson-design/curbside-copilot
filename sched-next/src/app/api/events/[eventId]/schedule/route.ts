import { NextResponse } from "next/server";
import { getEventSchedule } from "@/lib/schedule";

export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const schedule = await getEventSchedule(eventId);
  if (!schedule) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  return NextResponse.json(schedule);
}
