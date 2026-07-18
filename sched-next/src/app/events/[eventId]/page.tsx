import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/demo-user";
import Link from "next/link";
import { isAdmin } from "@/lib/demo-user";
import { getEventSchedule } from "@/lib/schedule";
import { fmtDateRange, fmtDay, fmtTime, fmtUnits } from "@/lib/format";
import { minutesToUnits, sessionMinutes, type RoundingMode } from "@/lib/credit-math";
import { ScheduleGrid, type GridSession } from "@/components/ScheduleGrid";

export const dynamic = "force-dynamic";

export default async function EventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const [schedule, user, creditTypes] = await Promise.all([
    getEventSchedule(eventId),
    currentUser(),
    db.creditType.findMany(),
  ]);
  if (!schedule) notFound();

  const agenda = user
    ? await db.agendaItem.findMany({ where: { personId: user.id }, select: { sessionId: true } })
    : [];
  const agendaSet = new Set(agenda.map((a) => a.sessionId));
  const typeById = new Map(creditTypes.map((t) => [t.id, t]));

  const sessions: GridSession[] = schedule.sessions.map((s) => {
    const minutes = sessionMinutes(s.startsAt, s.endsAt);
    return {
      id: s.id,
      title: s.title,
      speakers: s.speakers,
      track: s.track,
      room: s.room,
      day: fmtDay(s.startsAt),
      time: `${fmtTime(s.startsAt)}–${fmtTime(s.endsAt)}`,
      slotKey: s.startsAt.toISOString(),
      minutes,
      credits: s.credits.map((c) => {
        const t = typeById.get(c.creditTypeId);
        const units =
          c.fixedUnits ??
          (t
            ? minutesToUnits(minutes, {
                minutesPerUnit: t.minutesPerUnit,
                incrementMinutes: t.incrementMinutes,
                mode: t.roundingMode as RoundingMode,
              })
            : 0);
        return `${fmtUnits(units)} ${c.creditType}`;
      }),
      inAgenda: agendaSet.has(s.id),
    };
  });

  return (
    <main className="page wide">
      <div className="pagehead">
        <div className="eyebrow">Schedule</div>
        <h1>{schedule.name}</h1>
        <p className="sub">
          {fmtDateRange(schedule.startsAt, schedule.endsAt)} · {schedule.venue} ·{" "}
          {schedule.sessions.length} sessions
          {isAdmin(user) && (
            <>
              {" "}· <Link href={`/events/${schedule.id}/manage`}>Manage sessions</Link>
            </>
          )}
        </p>
      </div>
      <ScheduleGrid sessions={sessions} canAgenda={!!user} />
    </main>
  );
}
