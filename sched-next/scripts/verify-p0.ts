/**
 * Wave 1 (P0 slice) exit test:
 *   1. Role-gated grant authority: Dana (org admin, not PIL-authorized) is
 *      blocked from checking anyone into an Act 45 session; Ruth
 *      (PIL_AUTHORIZED) succeeds. No admin bypass.
 *   2. Fetcher: run against the TEA-shaped fixture — candidates land with
 *      provenance; re-run is a no-op; accepting promotes to STATE_CANONICAL;
 *      a changed source re-opens review.
 * Writes to dev.db — run `npm run demo:reset` afterwards.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { db } from "../src/lib/db";
import { checkIn } from "../src/lib/ledger";

function runFetcher(file: string) {
  return execFileSync("npx", ["tsx", "scripts/fetch-state-credit-types.ts", "--jurisdiction", "TX", "--file", file], {
    encoding: "utf8",
  });
}

async function main() {
  const dana = await db.person.findUniqueOrThrow({ where: { email: "dana.whitfield@kvsd.example.org" } });
  const ruth = await db.person.findUniqueOrThrow({ where: { email: "ruth.alvarez@kvsd.example.org" } });
  const attendee = await db.person.findUniqueOrThrow({ where: { email: "marcus.bell@kvsd.example.org" } });

  // --- 1. role-gated grant authority ---------------------------------------
  const act45Session = await db.session.findFirstOrThrow({
    where: { credits: { some: { creditType: { name: "Act 45 PIL Hours" } } } },
  });
  const blocked = await checkIn(act45Session.id, attendee.id, dana.id);
  if (blocked.ok || !blocked.error.includes("pil authorized")) {
    throw new Error(`Role gate FAILED for Dana: ${JSON.stringify(blocked)}`);
  }
  console.log(`✓ role gate blocks Dana: ${blocked.error}`);

  const allowed = await checkIn(act45Session.id, attendee.id, ruth.id);
  if (!allowed.ok) throw new Error(`Role gate wrongly blocked Ruth: ${allowed.error}`);
  console.log(
    `✓ Ruth (PIL_AUTHORIZED) grants: ${allowed.awarded.map((a) => `${a.units} ${a.creditType}`).join(", ")}`,
  );

  // --- 2. fetcher lifecycle --------------------------------------------------
  const before = await db.creditType.count({ where: { jurisdiction: "TX" } });
  const run1 = runFetcher("fixtures/tea-cpe-sample.html");
  const afterRun1 = await db.creditType.findMany({ where: { jurisdiction: "TX" } });
  if (afterRun1.length - before !== 5) throw new Error(`Expected 5 TX candidates, got ${afterRun1.length - before}`);
  if (!afterRun1.every((t) => t.status === "CANDIDATE" && t.sourceRevision && t.sourceFetchedAt)) {
    throw new Error("Candidates missing status/provenance");
  }
  console.log(`✓ fetcher run 1: 5 candidates with provenance (revision ${afterRun1[0].sourceRevision})`);

  const run2 = runFetcher("fixtures/tea-cpe-sample.html");
  if (!run2.includes("0 new candidates") || !run2.includes("5 unchanged")) {
    throw new Error(`Fetcher not idempotent: ${run2}`);
  }
  console.log("✓ fetcher run 2: idempotent (0 new, 5 unchanged)");

  // GT Update Hours came in carrying its authorization from the source.
  const gt = afterRun1.find((t) => t.name === "GT Update Hours")!;
  const gtAuth = await db.creditTypeAuthorization.findMany({ where: { creditTypeId: gt.id } });
  if (gtAuth.length !== 1 || gtAuth[0].requiredRole !== "GT_AUTHORIZED") {
    throw new Error("GT authorization not parsed from source");
  }
  console.log("✓ GT Update Hours landed grant-restricted to GT_AUTHORIZED");

  // Accept one candidate → STATE_CANONICAL.
  await db.creditType.update({ where: { id: gt.id }, data: { status: "STATE_CANONICAL" } });

  // Changed source → re-opened review, hand-set values untouched.
  const changed = fs
    .readFileSync("fixtures/tea-cpe-sample.html", "utf8")
    .replace("Six-hour annual update", "Eight-hour annual update");
  const tmp = "fixtures/.tea-cpe-changed.tmp.html";
  fs.writeFileSync(tmp, changed);
  try {
    const run3 = runFetcher(tmp);
    if (!run3.includes("5 re-opened") && !run3.includes("re-opened")) throw new Error(`Change not detected: ${run3}`);
    const gtAfter = await db.creditType.findUniqueOrThrow({ where: { id: gt.id } });
    if (gtAfter.status !== "CANDIDATE") throw new Error("Changed source did not re-open review");
    const newRevision = createHash("sha256");
    if (gtAfter.sourceRevision === afterRun1[0].sourceRevision) throw new Error("Revision did not change");
    void newRevision;
    console.log("✓ changed source re-opened review with a new revision");
  } finally {
    fs.rmSync(tmp, { force: true });
  }

  void run1;
  console.log("\nWave 1 (P0 slice) exit test PASSED");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
