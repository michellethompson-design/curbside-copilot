/**
 * Wave 4 exit test: magic-link auth lifecycle, organizer CRUD with idempotent
 * bulk paste, and certificate-name changes superseding issued certificates.
 * Writes to dev.db — run demo:reset after.
 */
import { db } from "../src/lib/db";
import { consumeLoginToken, createLoginToken, personForSession } from "../src/lib/auth";
import { bulkAddSessions, createEvent, deleteSessionIfEmpty } from "../src/lib/events";
import { ensureCertificate, verifyUcid } from "../src/lib/certificates";

async function main() {
  // --- auth -----------------------------------------------------------------
  const bad = await createLoginToken("nobody@nowhere.example");
  if (bad.ok) throw new Error("Token minted for unknown email");
  const link = await createLoginToken("dana.whitfield@kvsd.example.org");
  if (!link.ok) throw new Error(link.error);
  const token = new URL(`http://x${link.url}`).searchParams.get("token")!;
  const session = await consumeLoginToken(token);
  if (!session.ok) throw new Error(session.error);
  const who = await personForSession(session.sessionToken);
  if (who?.email !== "dana.whitfield@kvsd.example.org") throw new Error("Session resolved wrong person");
  const reuse = await consumeLoginToken(token);
  if (reuse.ok) throw new Error("Login token was reusable");
  console.log(`✓ magic link: unknown email refused, token single-use, session resolves ${who.name}`);

  // --- organizer CRUD -------------------------------------------------------
  const org = await db.organization.findFirstOrThrow();
  const event = await createEvent(org.id, {
    name: "October PD Day 2026",
    venue: "Maplewood Middle School",
    startISO: "2026-10-12",
    endISO: "2026-10-12",
  });
  if (!event) throw new Error("Event create failed");
  const act48 = await db.creditType.findFirstOrThrow({ where: { name: { contains: "Act 48" } } });

  const paste = [
    "Opening Keynote\tGeneral\tAuditorium\t2026-10-12\t8:00\t9:00\tDr. Feld",
    "Data Teams Workshop, Literacy, Room 104, 2026-10-12, 9:15, 10:45, Ana Duarte",
    "Broken line without a date",
    "Co-Teaching Clinic\tSpecial Education\tRoom 118\t2026-10-12\t9:15\t10:45",
  ].join("\n");
  const run1 = await bulkAddSessions(event.id, paste, [act48.id]);
  if (run1.created !== 3 || run1.errors.length !== 1) {
    throw new Error(`Bulk run1 wrong: ${JSON.stringify(run1)}`);
  }
  const run2 = await bulkAddSessions(event.id, paste, [act48.id]);
  if (run2.created !== 0 || run2.skipped !== 3) throw new Error(`Bulk not idempotent: ${JSON.stringify(run2)}`);
  const credits = await db.sessionCredit.count({ where: { session: { eventId: event.id } } });
  if (credits !== 3) throw new Error(`Credit attach wrong: ${credits}`);
  console.log("✓ bulk paste: 3 created (+1 line error reported), re-paste skips all 3, credit attached once");

  const target = await db.session.findFirstOrThrow({ where: { eventId: event.id, title: "Co-Teaching Clinic" } });
  const del = await deleteSessionIfEmpty(target.id);
  if (!del.ok) throw new Error(del.error);
  const guarded = await db.session.findFirstOrThrow({
    where: { attendance: { some: {} } },
  });
  const refuse = await deleteSessionIfEmpty(guarded.id);
  if (refuse.ok) throw new Error("Deleted a session with attendance");
  console.log(`✓ delete: empty session removed; attended session refused ("${refuse.error}")`);

  // --- certificate name change → supersession -------------------------------
  const dana = await db.person.findUniqueOrThrow({ where: { email: "dana.whitfield@kvsd.example.org" } });
  const ev25 = await db.event.findFirstOrThrow({ where: { name: "August Inservice 2025" } });
  const before = await ensureCertificate(dana.id, ev25.id);
  await db.$transaction([
    db.person.update({ where: { id: dana.id }, data: { certificateName: "Dana R. Whitfield" } }),
    db.nameChange.create({
      data: { personId: dana.id, fromName: "Dana Whitfield", toName: "Dana R. Whitfield", changedById: dana.id },
    }),
  ]);
  const after = await ensureCertificate(dana.id, ev25.id);
  if (!before || !after || before.ucid === after.ucid) throw new Error("Name change did not re-issue");
  if (after.personName !== "Dana R. Whitfield") throw new Error("New issue missing new name");
  const oldVerify = await verifyUcid(before.ucid);
  if (oldVerify!.status !== "SUPERSEDED") throw new Error("Old cert not superseded");
  const log = await db.nameChange.count({ where: { personId: dana.id } });
  if (log !== 1) throw new Error("Name change not logged");
  console.log(`✓ name change: ${before.ucid} → ${after.ucid} printed as "Dana R. Whitfield"; old UCID superseded; change logged`);

  console.log("\nWave 4 exit test PASSED");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
