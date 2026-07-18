import Link from "next/link";
import { db } from "@/lib/db";
import { currentUser, isAdmin } from "@/lib/demo-user";
import { fmtDateRange } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const user = await currentUser();
  const events = await db.event.findMany({
    orderBy: { startsAt: "desc" },
    include: {
      org: true,
      _count: { select: { sessions: true, creditRecords: true } },
    },
  });

  return (
    <main className="page">
      <div className="pagehead">
        <div className="eyebrow">{events[0]?.org.name ?? "Organization"}</div>
        <h1>Events</h1>
        <p className="sub">
          Every event this district runs, with its schedule and its credit record in one place.
          {isAdmin(user) && (
            <>
              {" "}<Link href="/events/new">Create an event</Link>.
            </>
          )}
        </p>
      </div>
      <table className="grid">
        <thead>
          <tr>
            <th>Event</th>
            <th>Dates</th>
            <th>Venue</th>
            <th className="num">Sessions</th>
            <th className="num">Ledger entries</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id}>
              <td>
                <Link href={`/events/${e.id}`} style={{ fontWeight: 600 }}>
                  {e.name}
                </Link>
              </td>
              <td>{fmtDateRange(e.startsAt, e.endsAt)}</td>
              <td>{e.venue}</td>
              <td className="num">{e._count.sessions}</td>
              <td className="num">{e._count.creditRecords.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
