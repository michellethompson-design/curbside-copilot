import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { canCheckIn, currentUser, isAdmin } from "@/lib/demo-user";
import { fmtDay, fmtTime, fmtUnits } from "@/lib/format";
import { minutesToUnits, sessionMinutes, type RoundingMode } from "@/lib/credit-math";
import { RosterCheckIn, type RosterPerson } from "@/components/RosterCheckIn";

export const dynamic = "force-dynamic";

export default async function CheckInPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const user = await currentUser();

  const session = await db.session.findUnique({
    where: { id: sessionId },
    include: {
      event: true,
      credits: { include: { creditType: true } },
      attendance: { select: { personId: true } },
    },
  });
  if (!session) notFound();
  if (!canCheckIn(user, session.eventId)) redirect(`/sessions/${sessionId}`);
  const admin = isAdmin(user);

  const people = await db.person.findMany({
    where: { orgId: session.event.orgId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });
  const checked = new Set(session.attendance.map((a) => a.personId));
  const roster: RosterPerson[] = people.map((p) => ({ ...p, checkedIn: checked.has(p.id) }));

  const minutes = sessionMinutes(session.startsAt, session.endsAt);
  const creditSummary = session.credits
    .map((c) => {
      const t = c.creditType;
      const units =
        c.fixedUnits ??
        minutesToUnits(minutes, {
          minutesPerUnit: t.minutesPerUnit,
          incrementMinutes: t.incrementMinutes,
          mode: t.roundingMode as RoundingMode,
        });
      return `${fmtUnits(units)} ${t.name}`;
    })
    .join(" + ");

  return (
    <main className="page wide">
      <div className="pagehead">
        <div className="eyebrow">
          Roster check-in · <Link href={`/events/${session.eventId}`}>{session.event.name}</Link>
        </div>
        <h1>{session.title}</h1>
        <p className="sub">
          {fmtDay(session.startsAt)} · {fmtTime(session.startsAt)}–{fmtTime(session.endsAt)} · {session.room}.
          Checking someone in writes attendance and appends the credit award to the ledger in the same
          step. Corrections are offsetting entries with a reason — the ledger itself is never edited.
        </p>
      </div>
      <RosterCheckIn
        sessionId={session.id}
        roster={roster}
        creditSummary={creditSummary || "no credit"}
        canCorrect={admin}
      />
    </main>
  );
}
