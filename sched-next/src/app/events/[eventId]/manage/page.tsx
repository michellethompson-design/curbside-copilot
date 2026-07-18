import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { currentUser, isAdmin } from "@/lib/demo-user";
import { bulkAddSessions, deleteSessionIfEmpty, easternWallTime } from "@/lib/events";
import { fmtDay, fmtTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ManageEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ bulk?: string; error?: string }>;
}) {
  const { eventId } = await params;
  const sp = await searchParams;
  const user = await currentUser();
  if (!isAdmin(user)) redirect(`/events/${eventId}`);

  const [event, creditTypes] = await Promise.all([
    db.event.findUnique({
      where: { id: eventId },
      include: {
        sessions: { orderBy: { startsAt: "asc" }, include: { _count: { select: { attendance: true } } } },
      },
    }),
    db.creditType.findMany({ where: { status: { not: "CANDIDATE" } }, orderBy: { name: "asc" } }),
  ]);
  if (!event) notFound();

  async function addSession(formData: FormData) {
    "use server";
    const actor = await currentUser();
    if (!isAdmin(actor)) return;
    const startsAt = easternWallTime(String(formData.get("date")), String(formData.get("start")));
    const endsAt = easternWallTime(String(formData.get("date")), String(formData.get("end")));
    const title = String(formData.get("title") ?? "").trim();
    if (!title || !startsAt || !endsAt || endsAt <= startsAt) {
      redirect(`/events/${eventId}/manage?error=Check the title and times`);
    }
    const session = await db.session.create({
      data: {
        eventId,
        title,
        track: String(formData.get("track") ?? "").trim() || "General",
        room: String(formData.get("room") ?? "").trim() || "TBD",
        speakers: String(formData.get("speakers") ?? "").trim(),
        startsAt,
        endsAt,
      },
    });
    for (const t of formData.getAll("creditTypeIds")) {
      await db.sessionCredit.create({ data: { sessionId: session.id, creditTypeId: String(t) } });
    }
    revalidatePath(`/events/${eventId}/manage`);
  }

  async function bulkAdd(formData: FormData) {
    "use server";
    const actor = await currentUser();
    if (!isAdmin(actor)) return;
    const summary = await bulkAddSessions(
      eventId,
      String(formData.get("bulk") ?? ""),
      formData.getAll("creditTypeIds").map(String),
    );
    const msg = `${summary.created} created, ${summary.skipped} skipped (already exist)${
      summary.errors.length ? `, ${summary.errors.length} line errors: ${summary.errors.map((e) => `#${e.line} ${e.message}`).join("; ")}` : ""
    }`;
    redirect(`/events/${eventId}/manage?bulk=${encodeURIComponent(msg)}`);
  }

  async function removeSession(formData: FormData) {
    "use server";
    const actor = await currentUser();
    if (!isAdmin(actor)) return;
    const result = await deleteSessionIfEmpty(String(formData.get("sessionId")));
    if (!result.ok) redirect(`/events/${eventId}/manage?error=${encodeURIComponent(result.error!)}`);
    revalidatePath(`/events/${eventId}/manage`);
  }

  return (
    <main className="page wide">
      <div className="pagehead">
        <div className="eyebrow">
          Organizer · <Link href={`/events/${event.id}`}>{event.name}</Link>
        </div>
        <h1>Manage sessions</h1>
        <p className="sub">
          Add sessions one at a time or paste a whole schedule. Re-pasting is safe: lines whose
          title and start time already exist are skipped, never duplicated.
        </p>
      </div>

      {sp.error && (
        <p role="alert" style={{ color: "var(--red)" }}>
          {decodeURIComponent(sp.error)}
        </p>
      )}
      {sp.bulk && (
        <p role="status" style={{ color: "var(--ledger-deep)", fontWeight: 600 }}>
          Bulk import: {decodeURIComponent(sp.bulk)}
        </p>
      )}

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", marginBottom: 24 }}>
        <form action={addSession} className="card" style={{ display: "grid", gap: 8 }}>
          <h2>Add one session</h2>
          <input type="text" name="title" required placeholder="Session title" />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input type="text" name="track" placeholder="Track" style={{ width: 140 }} />
            <input type="text" name="room" placeholder="Room" style={{ width: 110 }} />
            <input type="text" name="date" required placeholder="2026-10-12" style={{ width: 110 }} />
            <input type="text" name="start" required placeholder="9:15" style={{ width: 70 }} />
            <input type="text" name="end" required placeholder="10:45" style={{ width: 70 }} />
          </div>
          <input type="text" name="speakers" placeholder="Speakers (optional)" />
          <CreditChecks creditTypes={creditTypes} />
          <div>
            <button className="primary" type="submit">
              Add session
            </button>
          </div>
        </form>

        <form action={bulkAdd} className="card" style={{ display: "grid", gap: 8 }}>
          <h2>Paste a schedule</h2>
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--slate)" }}>
            One session per line: <span className="num">Title, Track, Room, 2026-10-12, 9:15, 10:45, Speakers</span>{" "}
            (tabs or commas).
          </p>
          <textarea
            name="bulk"
            rows={7}
            required
            style={{ font: "13px var(--mono)", padding: 8, border: "1px solid var(--rule)", borderRadius: 7 }}
            placeholder={"Opening Keynote, General, Auditorium, 2026-10-12, 8:00, 9:00\nData Teams Workshop, Literacy, Room 104, 2026-10-12, 9:15, 10:45, Dr. Feld"}
          />
          <CreditChecks creditTypes={creditTypes} />
          <div>
            <button className="primary" type="submit">
              Import lines
            </button>
          </div>
        </form>
      </div>

      <h2 style={{ marginBottom: 8 }}>
        Sessions <span className="badge track num">{event.sessions.length}</span>
      </h2>
      <table className="grid">
        <thead>
          <tr>
            <th>Title</th>
            <th>When</th>
            <th>Track / room</th>
            <th className="num">Checked in</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {event.sessions.map((s) => (
            <tr key={s.id}>
              <td>
                <Link href={`/sessions/${s.id}`} style={{ fontWeight: 600 }}>
                  {s.title}
                </Link>
              </td>
              <td style={{ color: "var(--slate)" }}>
                {fmtDay(s.startsAt)} · {fmtTime(s.startsAt)}–{fmtTime(s.endsAt)}
              </td>
              <td style={{ color: "var(--slate)" }}>
                {s.track} · {s.room}
              </td>
              <td className="num">{s._count.attendance}</td>
              <td>
                {s._count.attendance === 0 && (
                  <form action={removeSession}>
                    <input type="hidden" name="sessionId" value={s.id} />
                    <button className="quiet" style={{ fontSize: 12.5 }}>
                      Delete
                    </button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

function CreditChecks({ creditTypes }: { creditTypes: { id: string; name: string }[] }) {
  return (
    <fieldset style={{ border: "1px solid var(--rule)", borderRadius: 7, padding: "6px 10px" }}>
      <legend style={{ fontSize: 12, color: "var(--slate)", padding: "0 4px" }}>Credit offered</legend>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {creditTypes.map((t) => (
          <label key={t.id} style={{ fontSize: 13, display: "flex", gap: 5, alignItems: "center" }}>
            <input type="checkbox" name="creditTypeIds" value={t.id} defaultChecked={t.name.includes("Act 48")} />
            {t.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
