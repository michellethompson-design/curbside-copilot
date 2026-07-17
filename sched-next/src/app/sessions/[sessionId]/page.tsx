import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { canCheckIn, currentUser } from "@/lib/demo-user";
import { fmtDay, fmtTime, fmtUnits } from "@/lib/format";
import { minutesToUnits, sessionMinutes, type RoundingMode } from "@/lib/credit-math";
import { trackColor } from "@/lib/track-color";
import { AgendaButton } from "@/components/AgendaButton";

export const dynamic = "force-dynamic";

export default async function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const [session, user] = await Promise.all([
    db.session.findUnique({
      where: { id: sessionId },
      include: {
        event: true,
        credits: { include: { creditType: true } },
        _count: { select: { attendance: true } },
      },
    }),
    currentUser(),
  ]);
  if (!session) notFound();

  const minutes = sessionMinutes(session.startsAt, session.endsAt);
  const inAgenda = user
    ? !!(await db.agendaItem.findUnique({
        where: { personId_sessionId: { personId: user.id, sessionId } },
      }))
    : false;

  return (
    <main className="page">
      <div className="pagehead">
        <div className="eyebrow">
          <Link href={`/events/${session.eventId}`}>{session.event.name}</Link>
        </div>
        <h1>{session.title}</h1>
        <p className="sub">
          {fmtDay(session.startsAt)} · {fmtTime(session.startsAt)}–{fmtTime(session.endsAt)} ·{" "}
          {session.room} · <span className="num">{minutes} min</span>
        </p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span className="badge track" style={{ borderLeft: `3px solid ${trackColor(session.track)}` }}>
            {session.track}
          </span>
          {session.speakers && <span style={{ color: "var(--slate)" }}>{session.speakers}</span>}
          {session.capacity && (
            <span style={{ color: "var(--slate)" }} className="num">
              Capacity {session.capacity}
            </span>
          )}
          <span style={{ color: "var(--slate)" }} className="num">
            {session._count.attendance} checked in
          </span>
        </div>
        {session.description && <p style={{ marginBottom: 0 }}>{session.description}</p>}
      </div>

      <h2 style={{ marginBottom: 8 }}>Credit offered</h2>
      <table className="grid" style={{ marginBottom: 20 }}>
        <thead>
          <tr>
            <th>Credit type</th>
            <th className="num">Units on attendance</th>
            <th>How it is computed</th>
          </tr>
        </thead>
        <tbody>
          {session.credits.map((c) => {
            const t = c.creditType;
            const units =
              c.fixedUnits ??
              minutesToUnits(minutes, {
                minutesPerUnit: t.minutesPerUnit,
                incrementMinutes: t.incrementMinutes,
                mode: t.roundingMode as RoundingMode,
              });
            return (
              <tr key={c.id}>
                <td style={{ fontWeight: 600 }}>{t.name}</td>
                <td className="num">
                  <span className="badge credit num">{fmtUnits(units)}</span>
                </td>
                <td style={{ color: "var(--slate)" }}>
                  {c.fixedUnits != null
                    ? "Fixed award for this session."
                    : `${minutes} scheduled minutes, ${t.roundingMode.toLowerCase()} rounding at ${t.incrementMinutes}-minute increments.`}
                </td>
              </tr>
            );
          })}
          {session.credits.length === 0 && (
            <tr>
              <td colSpan={3} style={{ color: "var(--slate)" }}>
                This session does not carry credit.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div style={{ display: "flex", gap: 10 }}>
        {user && <AgendaButton sessionId={session.id} initial={inAgenda} />}
        {canCheckIn(user, session.eventId) && (
          <Link className="btn primary" href={`/sessions/${session.id}/checkin`}>
            Open roster check-in
          </Link>
        )}
      </div>
    </main>
  );
}
