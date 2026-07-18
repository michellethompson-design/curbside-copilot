/**
 * Block 6 exit test: connect to the MCP server the way Claude does (stdio),
 * run the demo question — "who still needs two more Act 48 hours?" — through
 * real tool calls, and cross-check the answer against the database directly.
 * Requires the app running on localhost:3000.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { db } from "../src/lib/db";

const THRESHOLD = 6; // required Act 48 hours in the demo window

async function main() {
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", "mcp/server.ts"],
    cwd: process.cwd(),
  });
  const client = new Client({ name: "verify-mcp", version: "0.0.1" });
  await client.connect(transport);

  const tools = await client.listTools();
  const names = tools.tools.map((t) => t.name).sort();
  console.log("tools:", names.join(", "));
  const expected = [
    "find_people_missing_credits",
    "get_compliance_report",
    "get_person_transcript",
    "get_schedule",
    "list_events",
  ];
  if (JSON.stringify(names) !== JSON.stringify(expected)) throw new Error("tool set mismatch");

  // Discover the district the way Claude would.
  const eventsRes = await client.callTool({ name: "list_events", arguments: {} });
  const orgs = JSON.parse((eventsRes.content as { text: string }[])[0].text).orgs;
  const org = orgs[0];
  console.log(`✓ list_events: ${org.name}, ${org.events.length} events`);

  // The demo question.
  const missingRes = await client.callTool({
    name: "find_people_missing_credits",
    arguments: { orgId: org.id, creditType: "Act 48", threshold: THRESHOLD, limit: 5 },
  });
  const missing = JSON.parse((missingRes.content as { text: string }[])[0].text);
  console.log(
    `✓ find_people_missing_credits(threshold ${THRESHOLD}): ${missing.totalBelowThreshold} people below, ` +
      `e.g. ${missing.people
        .slice(0, 3)
        .map((p: { name: string; shortfall: number }) => `${p.name} needs ${p.shortfall}`)
        .join("; ")}`,
  );

  // Cross-check against the ledger directly.
  const act48 = await db.creditType.findFirstOrThrow({ where: { name: { contains: "Act 48" } } });
  const sums = await db.creditRecord.groupBy({
    by: ["personId"],
    where: { creditTypeId: act48.id },
    _sum: { units: true },
  });
  const peopleCount = await db.person.count({ where: { orgId: org.id } });
  const withCredit = new Map(sums.map((s) => [s.personId, s._sum.units ?? 0]));
  const expectedBelow =
    [...withCredit.values()].filter((u) => Math.round(u * 10000) / 10000 < THRESHOLD).length +
    (peopleCount - withCredit.size);
  if (missing.totalBelowThreshold !== expectedBelow) {
    throw new Error(`MCP said ${missing.totalBelowThreshold}, ledger says ${expectedBelow}`);
  }
  console.log(`✓ cross-check: ledger agrees (${expectedBelow} people below ${THRESHOLD} hours)`);

  // Transcript through the wrapper matches the ledger too.
  const dana = await db.person.findUniqueOrThrow({
    where: { email: "dana.whitfield@kvsd.example.org" },
  });
  const tRes = await client.callTool({
    name: "get_person_transcript",
    arguments: { personId: dana.id },
  });
  const transcript = JSON.parse((tRes.content as { text: string }[])[0].text);
  const danaLedger = await db.creditRecord.aggregate({
    where: { personId: dana.id, creditTypeId: act48.id },
    _sum: { units: true },
  });
  const mcpTotal = transcript.totals.find((t: { creditType: string }) =>
    t.creditType.includes("Act 48"),
  )?.units;
  if (mcpTotal !== danaLedger._sum.units) {
    throw new Error(`Dana's transcript via MCP ${mcpTotal} != ledger ${danaLedger._sum.units}`);
  }
  console.log(`✓ get_person_transcript: Dana's Act 48 total ${mcpTotal} matches the ledger`);

  await client.close();
  console.log("\nBlock 6 exit test PASSED — Claude, connected to this server, answers the missing-credits question from seed data.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
