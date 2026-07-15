import { db } from "@/lib/db";

// One query shape shared by the schedule page, the schedule API route, and
// (through the route) the MCP get_schedule tool. The API is the contract; the
// page is just another client of the same read.
export async function getEventSchedule(eventId: string) {
  const event = await db.event.findUnique({
    where: { id: eventId },
    include: {
      sessions: {
        orderBy: [{ startsAt: "asc" }, { track: "asc" }],
        include: { credits: { include: { creditType: true } } },
      },
    },
  });
  if (!event) return null;
  return {
    id: event.id,
    name: event.name,
    venue: event.venue,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    sessions: event.sessions.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      speakers: s.speakers,
      track: s.track,
      room: s.room,
      capacity: s.capacity,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      credits: s.credits.map((c) => ({
        creditTypeId: c.creditTypeId,
        creditType: c.creditType.name,
        unit: c.creditType.unit,
        fixedUnits: c.fixedUnits,
      })),
    })),
  };
}
