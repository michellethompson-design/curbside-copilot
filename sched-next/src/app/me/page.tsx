import Link from "next/link";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/demo-user";
import { fmtDay, fmtTime } from "@/lib/format";
import { trackColor } from "@/lib/track-color";
import { ClipboardIllustration, RibbonIllustration } from "@/components/illustrations";

export const dynamic = "force-dynamic";

export default async function MyAgendaPage() {
  const user = await currentUser();
  if (!user) return null;
  const [items, credits] = await Promise.all([
    db.agendaItem.findMany({
      where: { personId: user.id },
      include: { session: { include: { event: true } } },
    }),
    db.creditRecord.findMany({
      where: { personId: user.id },
      include: { event: { select: { id: true, name: true, endsAt: true } } },
    }),
  ]);

  // Self-serve certificates: any event where this person's net credit is
  // positive. Lost the PDF? Come back here, any time, forever.
  const certByEvent = new Map<string, { name: string; endsAt: Date; units: number }>();
  for (const r of credits) {
    const e = certByEvent.get(r.event.id) ?? { name: r.event.name, endsAt: r.event.endsAt, units: 0 };
    e.units = Math.round((e.units + r.units) * 10000) / 10000;
    certByEvent.set(r.event.id, e);
  }
  const certificates = [...certByEvent.entries()]
    .filter(([, e]) => e.units > 0)
    .sort(([, a], [, b]) => b.endsAt.getTime() - a.endsAt.getTime());
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
        <div className="empty-state">
          <ClipboardIllustration />
          <h3 style={{ color: "var(--ink)" }}>Your agenda is a blank sign-in sheet</h3>
          <p>
            Open an <Link href="/">event schedule</Link> and add the sessions you plan to attend —
            attending them is what earns the credit.
          </p>
        </div>
      )}

      <section aria-label="My certificates" style={{ marginTop: 32 }}>
        <h2 style={{ marginBottom: 8 }}>My certificates</h2>
        {certificates.length === 0 ? (
          <div className="empty-state">
            <RibbonIllustration />
            <h3 style={{ color: "var(--ink)" }}>No certificates yet</h3>
            <p>
              They appear here after you attend credit-bearing sessions — and stay here forever, so a
              lost PDF is never an email to the PD office again.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {certificates.map(([eventId, e]) => (
              <Link key={eventId} className="btn" href={`/certificates/${user.id}/${eventId}`}>
                {e.name} — download certificate
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
