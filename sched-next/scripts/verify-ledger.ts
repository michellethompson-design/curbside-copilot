/**
 * Block 3 exit test, runnable any time: check 20 people into a session via the
 * ledger service, confirm ledger rows appear, confirm a correction offsets
 * cleanly, confirm the overlap rule holds, and confirm the ledger rejects
 * update/delete. Leaves marks on dev.db — run `npm run demo:reset` afterwards
 * for a pristine demo state.
 */
import { db } from "../src/lib/db";
import { bulkCheckIn, checkIn, undoCheckIn } from "../src/lib/ledger";

async function main() {
  const event = await db.event.findFirst({ where: { name: "August Inservice 2026" } });
  if (!event) throw new Error("Seed first");
  const dana = await db.person.findUniqueOrThrow({
    where: { email: "dana.whitfield@kvsd.example.org" },
  });

  // A 90-minute breakout and an overlapping session in the same slot.
  const sessions = await db.session.findMany({
    where: { eventId: event.id, title: { not: { contains: "Keynote" } } },
    orderBy: { startsAt: "asc" },
    take: 6,
  });
  const target = sessions[0];
  const overlapping = sessions.find(
    (s) => s.id !== target.id && s.startsAt < target.endsAt && s.endsAt > target.startsAt,
  )!;

  // First 20 get checked in; the rest stay clean for the race and bulk steps.
  const allPeople = await db.person.findMany({
    where: { orgId: event.orgId, email: { contains: "@kvsd" } },
    orderBy: { email: "asc" },
    take: 30,
  });
  const people = allPeople.slice(0, 20);

  console.log(`Target session: “${target.title}” (${target.id})`);

  // 1. Check 20 people in.
  let awarded = 0;
  for (const p of people) {
    const r = await checkIn(target.id, p.id, dana.id);
    if (!r.ok) throw new Error(`check-in failed for ${p.name}: ${r.error}`);
    awarded += r.awarded.length;
  }
  const ledgerRows = await db.creditRecord.count({ where: { sessionId: target.id } });
  console.log(`✓ 20 people checked in; ${ledgerRows} ledger rows for the session (${awarded} awards returned)`);

  // 2. Overlap rule.
  const clash = await checkIn(overlapping.id, people[0].id, dana.id);
  if (clash.ok) throw new Error("Overlap rule FAILED: double-booked attendance was allowed");
  console.log(`✓ overlap blocked: ${clash.error}`);

  // 3. Correction offsets cleanly.
  const before = await db.creditRecord.aggregate({
    where: { personId: people[0].id, sessionId: target.id },
    _sum: { units: true },
  });
  const undo = await undoCheckIn(target.id, people[0].id, "Verification: checked in by mistake", dana.id);
  if (!undo.ok) throw new Error(`undo failed: ${undo.error}`);
  const after = await db.creditRecord.aggregate({
    where: { personId: people[0].id, sessionId: target.id },
    _sum: { units: true },
  });
  const rows = await db.creditRecord.findMany({
    where: { personId: people[0].id, sessionId: target.id },
    orderBy: { createdAt: "asc" },
  });
  console.log(
    `✓ correction: net units ${before._sum.units} → ${after._sum.units}; ` +
      `${rows.length} rows kept (${rows.map((r) => `${r.kind} ${r.units}`).join(", ")})`,
  );
  if (after._sum.units !== 0) throw new Error("Correction did not net to zero");
  if (rows.some((r) => r.kind === "ADJUSTMENT" && !r.reason)) throw new Error("Adjustment missing reason");

  // 4. Ledger is append-only at the data layer.
  for (const attempt of [
    () => db.creditRecord.update({ where: { id: rows[0].id }, data: { units: 99 } }),
    () => db.creditRecord.delete({ where: { id: rows[0].id } }),
    () => db.creditRecord.deleteMany({ where: { sessionId: target.id } }),
  ]) {
    try {
      await attempt();
      throw new Error("Ledger guard FAILED: mutation went through");
    } catch (e) {
      if (!(e instanceof Error) || !e.message.includes("append-only")) throw e;
    }
  }
  console.log("✓ ledger guard: update, delete, deleteMany all rejected at the data layer");

  // 5. Two doors, same person, same instant: exactly one award lands.
  const racer = allPeople[25];
  const race = await Promise.all([
    checkIn(overlapping.id, racer.id, dana.id),
    checkIn(overlapping.id, racer.id, dana.id),
  ]);
  const okCount = race.filter((r) => r.ok).length;
  const raceRows = await db.attendance.count({
    where: { sessionId: overlapping.id, personId: racer.id },
  });
  if (okCount !== 1 || raceRows !== 1) {
    throw new Error(`Race check FAILED: ${okCount} successes, ${raceRows} attendance rows`);
  }
  console.log(
    `✓ concurrent taps: one landed, one answered “${race.find((r) => !r.ok && "error" in r)!.ok ? "" : (race.find((r) => !r.ok) as { error: string }).error}”`,
  );

  // 6. Bulk is a loop over the single path: five fresh people land, the
  // already-checked racer is skipped with a reason, and the overlap rule
  // skips anyone checked into a concurrent session (people[1] still holds
  // attendance on the target session from step 1).
  const bulkTargets = [...allPeople.slice(20, 25).map((p) => p.id), racer.id, people[1].id];
  const bulk = await bulkCheckIn(overlapping.id, bulkTargets, dana.id);
  console.log(
    `✓ bulk: ${bulk.checkedIn} checked in, ${bulk.skipped.length} skipped (${bulk.skipped
      .map((s) => s.error)
      .join(" | ")})`,
  );
  if (bulk.checkedIn !== 5 || bulk.skipped.length !== 2) {
    throw new Error(`Bulk accounting wrong: expected 5 in / 2 skipped, got ${bulk.checkedIn} / ${bulk.skipped.length}`);
  }

  console.log("\nBlock 3 exit test PASSED");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
