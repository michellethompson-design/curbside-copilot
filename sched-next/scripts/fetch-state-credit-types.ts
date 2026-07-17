/**
 * P0 Layer 1: the state credit-type fetcher.
 *
 * Pulls a state source (an agency reference page), parses credit types out of
 * its tables, and lands them in the catalog as CANDIDATE entries carrying full
 * provenance — source URL, fetch time, a content hash of the source, and a
 * parse-confidence grade. Nothing a fetcher lands is live until an admin
 * accepts it in the review queue (settings → credit types), where it becomes
 * STATE_CANONICAL. If a later run sees the source changed (content hash
 * differs), the entry re-opens as CANDIDATE for re-review.
 *
 *   npx tsx scripts/fetch-state-credit-types.ts --jurisdiction TX --file fixtures/tea-cpe-sample.html
 *   npx tsx scripts/fetch-state-credit-types.ts --jurisdiction TX --url https://tea.texas.gov/...
 *
 * Idempotent: same source, same result — reruns create nothing new.
 * California, per the official P2 notes, publishes no list: that is simply
 * this fetcher never running for CA, and the district defining its own types
 * (graceful degradation to DISTRICT_CANONICAL).
 *
 * The parser targets header-labeled tables (name/unit/minutes/increment/
 * rounding/authorization columns, fuzzily matched). Live agency pages vary —
 * verify once against the real page and extend the header map if needed.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import { db } from "../src/lib/db";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

type ParsedType = {
  name: string;
  unit: string;
  minutesPerUnit: number | null;
  incrementMinutes: number | null;
  roundingMode: string | null;
  requiredRole: string | null;
  complete: boolean;
};

const stripTags = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

function parseTables(html: string): ParsedType[] {
  const out: ParsedType[] = [];
  for (const table of html.match(/<table[\s\S]*?<\/table>/gi) ?? []) {
    const rows = table.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
    if (rows.length < 2) continue;
    const headerRow = rows[0] ?? "";
    const headers = (headerRow.match(/<t[hd][\s\S]*?<\/t[hd]>/gi) ?? []).map((c) => stripTags(c).toLowerCase());
    const col = (...needles: string[]) =>
      headers.findIndex((h) => needles.some((n) => h.includes(n)));
    const iName = col("credit type", "type", "name");
    const iUnit = col("unit");
    const iMinutes = col("minutes per");
    const iIncrement = col("increment");
    const iRounding = col("rounding");
    const iAuth = col("authorization", "authorized");
    if (iName < 0) continue;

    for (const row of rows.slice(1)) {
      const cells = (row.match(/<t[hd][\s\S]*?<\/t[hd]>/gi) ?? []).map(stripTags);
      const name = cells[iName];
      if (!name) continue;
      const minutesPerUnit = iMinutes >= 0 && /^\d+$/.test(cells[iMinutes] ?? "") ? Number(cells[iMinutes]) : null;
      const incrementMinutes = iIncrement >= 0 && /^\d+$/.test(cells[iIncrement] ?? "") ? Number(cells[iIncrement]) : null;
      const roundingRaw = iRounding >= 0 ? (cells[iRounding] ?? "").toUpperCase() : "";
      const roundingMode = ["FLOOR", "NEAREST", "CEILING"].includes(roundingRaw) ? roundingRaw : null;
      const authRaw = iAuth >= 0 ? (cells[iAuth] ?? "").trim() : "";
      const requiredRole = authRaw ? authRaw.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/_+$/, "") : null;
      out.push({
        name,
        unit: (iUnit >= 0 && cells[iUnit]) || "hours",
        minutesPerUnit,
        incrementMinutes,
        roundingMode,
        requiredRole,
        complete: minutesPerUnit !== null && incrementMinutes !== null && roundingMode !== null,
      });
    }
  }
  return out;
}

async function main() {
  const jurisdiction = arg("jurisdiction");
  const file = arg("file");
  const url = arg("url");
  if (!jurisdiction || (!file && !url)) {
    console.error("Usage: --jurisdiction TX  (--file <path> | --url <https://…>)");
    process.exit(1);
  }

  const source = url ?? file!;
  const html = url
    ? await fetch(url).then((r) => {
        if (!r.ok) throw new Error(`${r.status} fetching ${url}`);
        return r.text();
      })
    : fs.readFileSync(file!, "utf8");
  const revision = createHash("sha256").update(stripTags(html)).digest("hex").slice(0, 12);
  const parsed = parseTables(html);
  if (parsed.length === 0) throw new Error("No credit types parsed — the page's table shape needs a header-map extension.");

  const org = await db.organization.findFirstOrThrow();
  let created = 0;
  let unchanged = 0;
  let reopened = 0;

  for (const p of parsed) {
    const existing = await db.creditType.findUnique({
      where: { orgId_jurisdiction_name: { orgId: org.id, jurisdiction, name: p.name } },
      include: { authorizations: true },
    });
    const provenance = {
      sourceUrl: url ?? `file://${file}`,
      sourceFetchedAt: new Date(),
      sourceRevision: revision,
      sourceConfidence: p.complete ? "HIGH" : "MEDIUM",
    };

    if (!existing) {
      await db.creditType.create({
        data: {
          orgId: org.id,
          jurisdiction,
          name: p.name,
          unit: p.unit,
          minutesPerUnit: p.minutesPerUnit ?? 60,
          incrementMinutes: p.incrementMinutes ?? 15,
          roundingMode: p.roundingMode ?? "NEAREST",
          status: "CANDIDATE",
          ...provenance,
          ...(p.requiredRole
            ? { authorizations: { create: [{ requiredRole: p.requiredRole }] } }
            : {}),
        },
      });
      created++;
    } else if (existing.sourceRevision === revision) {
      unchanged++;
    } else {
      // The source changed since this entry was reviewed: refresh provenance
      // and re-open review. Hand-entered values are never silently replaced.
      await db.creditType.update({
        where: { id: existing.id },
        data: { ...provenance, status: "CANDIDATE" },
      });
      reopened++;
    }
  }

  console.log(
    `Fetched ${jurisdiction} credit types from ${source} (revision ${revision}):\n` +
      `  ${created} new candidates, ${unchanged} unchanged, ${reopened} re-opened for review.\n` +
      `Review queue: /settings/credit-types`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
