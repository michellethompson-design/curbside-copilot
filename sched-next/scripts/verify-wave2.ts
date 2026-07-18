/**
 * Wave 2 exit test: certificate issuance + UCID verification + supersession,
 * export presets, and MVAR extensions. Writes to dev.db — run demo:reset after.
 */
import { db } from "../src/lib/db";
import { ensureCertificate, verifyUcid } from "../src/lib/certificates";
import { buildExportRows } from "../src/lib/compliance";
import { getPreset, renderCsv } from "../src/lib/presets";
import { checkIn } from "../src/lib/ledger";

async function main() {
  const dana = await db.person.findUniqueOrThrow({ where: { email: "dana.whitfield@kvsd.example.org" } });
  const ruth = await db.person.findUniqueOrThrow({ where: { email: "ruth.alvarez@kvsd.example.org" } });
  const ev25 = await db.event.findFirstOrThrow({ where: { name: "August Inservice 2025" } });

  // 1. Issue + verify.
  const issue = await ensureCertificate(dana.id, ev25.id);
  if (!issue) throw new Error("No certificate issued");
  if (!/^KV-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(issue.ucid)) throw new Error(`Bad UCID ${issue.ucid}`);
  const verified = await verifyUcid(issue.ucid.toLowerCase());
  if (!verified || verified.status !== "VALID" || verified.attendeeName !== "Dana Whitfield") {
    throw new Error("Verification failed");
  }
  console.log(`✓ issued + verified ${issue.ucid} (${verified.totals.map((t) => `${t.units} ${t.creditType}`).join(", ")})`);

  // 2. Idempotent while the ledger is unchanged.
  const again = await ensureCertificate(dana.id, ev25.id);
  if (again!.ucid !== issue.ucid) throw new Error("Re-view minted a new UCID without a ledger change");
  console.log("✓ stable UCID while the ledger is unchanged");

  // 3. Ledger change → supersession, both UCIDs verifiable.
  const extraSession = await db.session.findFirstOrThrow({
    where: { eventId: ev25.id, attendance: { none: { personId: dana.id } } },
    orderBy: { startsAt: "desc" },
  });
  const r = await checkIn(extraSession.id, dana.id, ruth.id);
  if (!r.ok) throw new Error(`Setup check-in failed: ${r.error}`);
  const newIssue = await ensureCertificate(dana.id, ev25.id);
  if (newIssue!.ucid === issue.ucid) throw new Error("Ledger change did not supersede");
  const old = await verifyUcid(issue.ucid);
  if (old!.status !== "SUPERSEDED" || old!.supersededByUcid !== newIssue!.ucid) {
    throw new Error("Old UCID not marked superseded correctly");
  }
  console.log(`✓ supersession: ${issue.ucid} → ${newIssue!.ucid}; old UCID still verifiable, marked superseded`);

  // 4. Presets render from one row shape; UCIDs appear where issued.
  const act48 = await db.creditType.findFirstOrThrow({ where: { name: { contains: "Act 48" } } });
  const data = await buildExportRows(dana.orgId, act48.id);
  const danaRow = data!.rows.find((row) => row.lastName === "Whitfield");
  if (!danaRow || danaRow.ucid !== newIssue!.ucid) throw new Error("Export row missing current UCID");
  for (const id of ["generic-mvar", "pa-perms", "tx-tea", "ca-mvar"]) {
    const preset = getPreset(id);
    const csv = renderCsv(preset, data!.rows.slice(0, 5));
    const header = csv.split("\r\n")[0];
    if (header.split(",").length !== preset.columns.length) throw new Error(`Preset ${id} header mismatch`);
  }
  console.log(`✓ 4 presets render; Dana's row carries her current UCID (${danaRow.ucid})`);

  // 5. MVAR extension recorded on a restricted grant.
  const act45Session = await db.session.findFirstOrThrow({
    where: { credits: { some: { creditType: { name: "Act 45 PIL Hours" } } } },
  });
  const marcus = await db.person.findUniqueOrThrow({ where: { email: "marcus.bell@kvsd.example.org" } });
  const grant = await checkIn(act45Session.id, marcus.id, ruth.id);
  if (!grant.ok) throw new Error(`Restricted grant failed: ${grant.error}`);
  const rec = await db.creditRecord.findFirstOrThrow({
    where: { personId: marcus.id, sessionId: act45Session.id, creditType: { name: "Act 45 PIL Hours" } },
  });
  const ext = JSON.parse(rec.extensionsJson ?? "{}");
  if (ext.credit_type_authorization_role !== "PIL_AUTHORIZED") {
    throw new Error(`Extension missing: ${rec.extensionsJson}`);
  }
  if (JSON.parse(marcus.licenseIdsJson ?? "[]").length !== 2) throw new Error("Multi-license extension missing");
  console.log("✓ MVAR extensions: authorization role on the award, multi-license array on the person");

  console.log("\nWave 2 exit test PASSED");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
