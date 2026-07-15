import Link from "next/link";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/demo-user";
import { fmtDay, fmtTime } from "@/lib/format";
import { trackColor } from "@/lib/track-color";

export const dynamic = "force-dynamic";

export default async function MyAgendaPage() {
  const user = await currentUser();
  if (!user) return null;
  const items = await db.agendaItem.findMany({
    where: { personId: user.id },
    include: { session: { include: { event: true } } },
  });
  const sorted = items
    .map((i) => i.session)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  const byDay = new Map<string, typeof sorted>();
  for (const s of sorted) {
    const d = fmtDay(s.startsAt);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push(s);
  }

  return (
    <main className="page">
      <div className="pagehead">
        <div className="eyebrow">Personal agenda</div>
        <h1>{user.name}&rsquo;s agenda</h1>
        <p className="sub">
          {sorted.length} sessions across{" "}
          {new Set(sorted.map((s) => s.eventId)).size} event
          {new Set(sorted.map((s) => s.eventId)).size === 1 ? "" : "s"}. Sessions you attend are what
          turn into credit — the agenda is the plan, the ledger is the record.
        </p>
      </div>
      {[...byDay.entries()].map(([day, sessions]) => (
        <section key={day} aria-label={day}>
          <div className="slot-head">{day}</div>
          <div className="session-list" style={{ gridTemplateColumns: "1fr" }}>
            {sessions.map((s) => (
              <article key={s.id} className="session-card" style={{ borderLeftColor: trackColor(s.track) }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <Link className="title" href={`/sessions/${s.id}`}>
                    {s.title}
                  </Link>
                  <span className="num" style={{ color: "var(--slate)", fontSize: 13 }}>
                    {fmtTime(s.startsAt)}–{fmtTime(s.endsAt)}
                  </span>
                </div>
                <div className="meta">
                  <span className="badge track">{s.track}</span>
                  <span>{s.room}</span>
                  <span>{s.event.name}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
      {sorted.length === 0 && (
        <p style={{ color: "var(--slate)" }}>
          Nothing here yet. Open an <Link href="/">event schedule</Link> and add sessions.
        </p>
      )}
    </main>
  );
}
