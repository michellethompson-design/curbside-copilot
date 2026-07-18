import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { currentUser, isAdmin } from "@/lib/demo-user";
import { createEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  const user = await currentUser();
  if (!isAdmin(user)) redirect("/");

  async function create(formData: FormData) {
    "use server";
    const actor = await currentUser();
    if (!isAdmin(actor)) redirect("/");
    const org = await db.organization.findFirstOrThrow();
    const event = await createEvent(org.id, {
      name: String(formData.get("name") ?? ""),
      venue: String(formData.get("venue") ?? ""),
      startISO: String(formData.get("start") ?? ""),
      endISO: String(formData.get("end") ?? ""),
    });
    redirect(event ? `/events/${event.id}/manage` : "/events/new?error=1");
  }

  return (
    <main className="page" style={{ maxWidth: 620 }}>
      <div className="pagehead">
        <div className="eyebrow">Organizer</div>
        <h1>New event</h1>
        <p className="sub">Create the event, then add sessions one by one or paste a whole schedule.</p>
      </div>
      <form action={create} className="card" style={{ display: "grid", gap: 10 }}>
        <label>
          Event name
          <input type="text" name="name" required placeholder="October PD Day 2026" style={{ width: "100%" }} />
        </label>
        <label>
          Venue
          <input type="text" name="venue" placeholder="Keystone Valley High School" style={{ width: "100%" }} />
        </label>
        <div style={{ display: "flex", gap: 10 }}>
          <label>
            First day
            <input type="text" name="start" required placeholder="2026-10-12" style={{ width: 130 }} />
          </label>
          <label>
            Last day
            <input type="text" name="end" required placeholder="2026-10-12" style={{ width: 130 }} />
          </label>
        </div>
        <div>
          <button className="primary" type="submit">
            Create event
          </button>
        </div>
      </form>
    </main>
  );
}
