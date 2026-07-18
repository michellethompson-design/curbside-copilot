/**
 * Wave 3 exit test: off-platform claim state machine (approve writes the
 * ledger; reject and request-changes don't; resubmit loops), and two-person
 * corrections (requester can't self-approve; approval executes offsets).
 * Writes to dev.db — run demo:reset after.
 */
import { db } from "../src/lib/db";
import { submitClaim, transitionClaim, resubmitClaim } from "../src/lib/claims";
import { requestCorrection, decideCorrection } from "../src/lib/corrections";
import { checkIn } from "../src/lib/ledger";
import { getPersonTranscript } from "../src/lib/transcript";

async function main() {
  const dana = await db.person.findUniqueOrThrow({ where: { email: "dana.whitfield@kvsd.example.org" } });
  const ruth = await db.person.findUniqueOrThrow({ where: { email: "ruth.alvarez@kvsd.example.org" } });
  const marcus = await db.person.findUniqueOrThrow({ where: { email: "marcus.bell@kvsd.example.org" } });
  const act48 = await db.creditType.findFirstOrThrow({ where: { name: { contains: "Act 48" } } });

  // --- claims ---------------------------------------------------------------
  const before = (await getPersonTranscript(marcus.id))!.totals.find((t) => t.creditType.includes("Act 48"))?.units ?? 0;

  const seeded = await db.claim.findFirstOrThrow({ where: { personId: marcus.id, status: "SUBMITTED" } });
  const changes = await transitionClaim(seeded.id, dana.id, "CHANGES_REQUESTED", "Attach the agenda PDF.");
  if (!changes.ok) throw new Error(changes.error);
  const resub = await resubmitClaim(seeded.id, marcus.id, "Agenda attached now.");
  if (!resub.ok) throw new Error(resub.error);
  const approve = await transitionClaim(seeded.id, dana.id, "APPROVED", "", 2.5);
  if (!approve.ok) throw new Error(approve.error);
  const afterApprove = (await getPersonTranscript(marcus.id))!.totals.find((t) => t.creditType.includes("Act 48"))!.units;
  if (Math.abs(afterApprove - before - 2.5) > 1e-9) {
    throw new Error(`Approved units not on transcript: ${before} → ${afterApprove}`);
  }
  const doubled = await transitionClaim(seeded.id, dana.id, "APPROVED", "", 2.5);
  if (doubled.ok) throw new Error("Terminal claim accepted a second approval");
  console.log(`✓ claim: changes → resubmit → approved 2.50 on the ledger (${before} → ${afterApprove}); terminal state locked`);

  const rejected = await submitClaim({
    personId: marcus.id, orgId: marcus.orgId, creditTypeId: act48.id,
    title: "Webinar with no evidence", provider: "Somewhere", activityDate: new Date("2026-05-05"),
    unitsRequested: 1, note: "",
  });
  if (!rejected.ok) throw new Error(rejected.error);
  const rej = await db.claim.findFirstOrThrow({ where: { personId: marcus.id, title: { contains: "Webinar" } } });
  const rr = await transitionClaim(rej.id, dana.id, "REJECTED", "No evidence provided.");
  if (!rr.ok) throw new Error(rr.error);
  const afterReject = (await getPersonTranscript(marcus.id))!.totals.find((t) => t.creditType.includes("Act 48"))!.units;
  if (afterReject !== afterApprove) throw new Error("Rejection touched the ledger");
  const trail = await db.claimEvent.count({ where: { claimId: seeded.id } });
  if (trail < 4) throw new Error(`Claim trail too short: ${trail}`);
  console.log(`✓ rejection writes nothing; ${trail} events on the approved claim's trail`);

  // Transcript shows the off-platform entry with provenance.
  const t = await getPersonTranscript(marcus.id);
  const entry = t!.entries.find((e) => e.sessionTitle.includes("Regional Literacy"));
  if (!entry || !entry.eventName.includes("Off-platform")) throw new Error("Off-platform entry missing from transcript");
  console.log(`✓ transcript entry: "${entry.sessionTitle}" under "${entry.eventName}"`);

  // --- corrections ----------------------------------------------------------
  const session = await db.session.findFirstOrThrow({
    where: { event: { name: "August Inservice 2026" }, title: { not: { contains: "Keynote" } }, credits: { none: { creditType: { name: { contains: "Act 45" } } } } },
  });
  const target = await db.person.findFirstOrThrow({ where: { email: { contains: "aaron.abbott" } } });
  const ci = await checkIn(session.id, target.id, dana.id);
  if (!ci.ok) throw new Error(ci.error);

  const req = await requestCorrection(session.id, target.id, dana.id, "WRONG_PERSON", "Meant the other Aaron.");
  if (!req.ok) throw new Error(req.error);
  const request = await db.correctionRequest.findFirstOrThrow({ where: { sessionId: session.id, status: "PENDING" } });

  const self = await decideCorrection(request.id, dana.id, true, "");
  if (self.ok) throw new Error("Requester approved their own correction");
  console.log(`✓ self-approval blocked: ${(self as { error: string }).error}`);

  const other = await decideCorrection(request.id, ruth.id, true, "Confirmed with the room lead.");
  if (!other.ok) throw new Error(other.error);
  const net = await db.creditRecord.aggregate({
    where: { personId: target.id, sessionId: session.id },
    _sum: { units: true },
  });
  const gone = await db.attendance.findUnique({
    where: { sessionId_personId: { sessionId: session.id, personId: target.id } },
  });
  if (net._sum.units !== 0 || gone) throw new Error("Approval did not execute offsets");
  const adj = await db.creditRecord.findFirstOrThrow({
    where: { personId: target.id, sessionId: session.id, kind: "ADJUSTMENT" },
  });
  if (!adj.reason?.startsWith("Wrong person tapped")) throw new Error(`Reason code not in ledger reason: ${adj.reason}`);
  console.log(`✓ second-admin approval executed offsets, net 0, reason "${adj.reason}"`);

  console.log("\nWave 3 exit test PASSED");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
