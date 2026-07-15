/**
 * Legacy Sched → Sched Next bridge.
 *
 * Pulls a real event out of a legacy *.sched.com site and lands it in the
 * Stage 0 schema, so the credit ledger, transcript, compliance export, and
 * MCP server run against real district data. Two modes:
 *
 *   ICS (no credentials — every public event site serves this):
 *     npx tsx scripts/import-sched.ts --ics https://SUBDOMAIN.sched.com/all.ics
 *     npx tsx scripts/import-sched.ts --ics ./all.ics --name "Iowa FBLA 2018"
 *
 *   API (the event's api key, from Sched's settings; imports people too):
 *     npx tsx scripts/import-sched.ts --api SUBDOMAIN --key SCHED_API_KEY
 *
 * Options:
 *   --name "Display Name"   Event name override (default: calendar/subdomain name)
 *   --venue "Venue"         Venue label (default: "Imported from Sched")
 *   --credit "Act 48"       Attach this credit type (name substring) to every
 *                           imported session. Omit to import without credit.
 *
 * Idempotent per SPEC.md Stage 1: events key on the source subdomain/URL and
 * sessions on their stable source id (ICS UID / API key), so re-running an
 * import updates in place — it never duplicates venues, sessions, or people.
 * People (API mode) key on email, the same identity rule the seed uses.
 *
 * Attendance is deliberately NOT imported: check-in is the credit-bearing act
 * and it happens here, in roster mode, where the ledger can vouch for it.
 * Legacy Sched keeps the schedule it is loved for; this side owns the record.
 *
 * Note: API mode is written to Sched's documented per-event export endpoints
 * (/api/session/export, /api/user/export). Field names in the wild vary by
 * export version, so the mapper accepts the known variants — verify once
 * against your event's key and adjust the candidate lists if needed.
 */
import fs from "node:fs";
import { db } from "../src/lib/db";

type SessionRow = {
  externalId: string;
  title: string;
  description: string;
  speakers: string;
  track: string;
  room: string;
  startsAt: Date;
  endsAt: Date;
};

// ---------------------------------------------------------------- args ----
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

// ------------------------------------------------------------- ICS mode ----
// Minimal RFC 5545 reader: unfold continuation lines, walk VEVENT blocks.
// Sched emits standard VEVENTs (UID, SUMMARY, DTSTART/DTEND, LOCATION,
// DESCRIPTION, sometimes CATEGORIES for the session type/track).
function parseIcs(text: string): { calName: string | null; rows: SessionRow[] } {
  const unfolded = text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const rows: SessionRow[] = [];
  let calName: string | null = null;
  let cur: Record<string, string> | null = null;

  for (const line of unfolded) {
    if (line.startsWith("X-WR-CALNAME")) calName = line.slice(line.indexOf(":") + 1).trim();
    if (line === "BEGIN:VEVENT") cur = {};
    else if (line === "END:VEVENT" && cur) {
      if (cur.SUMMARY && cur.DTSTART && cur.DTEND) {
        rows.push({
          externalId: cur.UID ?? `${cur.SUMMARY}|${cur.DTSTART}`,
          title: unescapeIcs(cur.SUMMARY),
          description: unescapeIcs(cur.DESCRIPTION ?? ""),
          speakers: extractSpeakers(cur.DESCRIPTION ?? ""),
          track: unescapeIcs(cur.CATEGORIES ?? "") || "General",
          room: unescapeIcs(cur.LOCATION ?? "") || "TBD",
          startsAt: parseIcsDate(cur.DTSTART, cur.DTSTART_TZID),
          endsAt: parseIcsDate(cur.DTEND, cur.DTEND_TZID),
        });
      }
      cur = null;
    } else if (cur) {
      const colon = line.indexOf(":");
      if (colon < 0) continue;
      const [rawKey, value] = [line.slice(0, colon), line.slice(colon + 1)];
      const [key, ...params] = rawKey.split(";");
      cur[key] = value;
      const tzid = params.find((p) => p.startsWith("TZID="));
      if (tzid) cur[`${key}_TZID`] = tzid.slice(5);
    }
  }
  return { calName, rows };
}

function unescapeIcs(v: string): string {
  return v.replace(/\\n/g, "\n").replace(/\\([,;])/g, "$1").replace(/\\\\/g, "\\").trim();
}

// Sched ICS descriptions commonly lead with "Speakers: A, B" or embed
// "Moderator/Speaker" lines; grab the first such line when present.
function extractSpeakers(description: string): string {
  const m = unescapeIcs(description).match(/^\s*(?:speakers?|presenters?|moderators?)\s*:\s*(.+)$/im);
  return m ? m[1].trim() : "";
}

function parseIcsDate(v: string, tzid?: string): Date {
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!m) throw new Error(`Unparseable ICS date: ${v}`);
  const [, y, mo, d, h, mi, s, z] = m;
  if (z === "Z" || !tzid) {
    return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
  }
  // TZID-local wall time → UTC via Intl (no dependencies).
  const utcGuess = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
  const inTz = new Date(utcGuess.toLocaleString("en-US", { timeZone: tzid }));
  const offset = utcGuess.getTime() - inTz.getTime();
  return new Date(utcGuess.getTime() + offset);
}

// ------------------------------------------------------------- API mode ----
function firstString(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

async function fetchApiSessions(subdomain: string, key: string): Promise<SessionRow[]> {
  const url = `https://${subdomain}.sched.com/api/session/export?api_key=${key}&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sched API ${res.status} for ${url}`);
  const data = (await res.json()) as Record<string, unknown>[];
  return data.map((s) => {
    const start = firstString(s, ["session_start", "event_start", "start"]);
    const end = firstString(s, ["session_end", "event_end", "end"]);
    return {
      externalId: firstString(s, ["event_key", "id", "session_key"]) || `${firstString(s, ["name"])}|${start}`,
      title: firstString(s, ["name", "session_title", "title"]),
      description: firstString(s, ["description", "session_description"]),
      speakers: firstString(s, ["speakers", "artists", "moderators"]),
      track: firstString(s, ["session_type", "event_type", "type"]) || "General",
      room: firstString(s, ["venue", "room", "location"]) || "TBD",
      startsAt: new Date(start.replace(" ", "T")),
      endsAt: new Date(end.replace(" ", "T")),
    };
  }).filter((s) => s.title && !Number.isNaN(s.startsAt.getTime()) && !Number.isNaN(s.endsAt.getTime()));
}

async function fetchApiPeople(subdomain: string, key: string) {
  const url = `https://${subdomain}.sched.com/api/user/export?api_key=${key}&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sched API ${res.status} for ${url}`);
  const data = (await res.json()) as Record<string, unknown>[];
  return data
    .map((u) => ({
      name: firstString(u, ["name", "username"]),
      email: firstString(u, ["email"]).toLowerCase(),
    }))
    .filter((u) => u.name && u.email);
}

// ----------------------------------------------------------------- main ----
async function main() {
  const ics = arg("ics");
  const api = arg("api");
  const key = arg("key");
  if (!ics && !(api && key)) {
    console.error("Usage: --ics <file-or-url>  |  --api <subdomain> --key <api_key>   [--name --venue --credit]");
    process.exit(1);
  }

  let rows: SessionRow[];
  let sourceId: string;
  let defaultName: string;
  let people: { name: string; email: string }[] = [];

  if (ics) {
    const text = /^https?:/.test(ics)
      ? await fetch(ics).then((r) => {
          if (!r.ok) throw new Error(`${r.status} fetching ${ics}`);
          return r.text();
        })
      : fs.readFileSync(ics, "utf8");
    const parsed = parseIcs(text);
    rows = parsed.rows;
    sourceId = ics;
    defaultName = parsed.calName ?? ics.replace(/^https?:\/\//, "").split(/[./]/)[0];
  } else {
    rows = await fetchApiSessions(api!, key!);
    people = await fetchApiPeople(api!, key!);
    sourceId = `${api}.sched.com`;
    defaultName = api!;
  }
  if (rows.length === 0) throw new Error("No sessions found in source — nothing imported.");

  const org = await db.organization.findFirstOrThrow();
  const name = arg("name") ?? defaultName;
  const venue = arg("venue") ?? "Imported from Sched";
  const startsAt = new Date(Math.min(...rows.map((r) => r.startsAt.getTime())));
  const endsAt = new Date(Math.max(...rows.map((r) => r.endsAt.getTime())));

  // Event upsert keyed on the source, so re-imports refresh the same event.
  let event = await db.event.findFirst({ where: { orgId: org.id, externalId: sourceId } });
  if (event) {
    event = await db.event.update({ where: { id: event.id }, data: { name, venue, startsAt, endsAt } });
  } else {
    event = await db.event.create({
      data: { orgId: org.id, name, venue, startsAt, endsAt, externalId: sourceId },
    });
  }

  let created = 0;
  let updated = 0;
  for (const r of rows) {
    const data = {
      title: r.title,
      description: r.description,
      speakers: r.speakers,
      track: r.track,
      room: r.room,
      startsAt: r.startsAt,
      endsAt: r.endsAt,
    };
    const existing = await db.session.findUnique({
      where: { eventId_externalId: { eventId: event.id, externalId: r.externalId } },
    });
    if (existing) {
      await db.session.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await db.session.create({ data: { ...data, eventId: event.id, externalId: r.externalId } });
      created++;
    }
  }

  let peopleCreated = 0;
  for (const p of people) {
    const existing = await db.person.findUnique({ where: { email: p.email } });
    if (!existing) {
      await db.person.create({ data: { orgId: org.id, name: p.name, email: p.email } });
      peopleCreated++;
    }
  }

  // Optional credit attachment, e.g. --credit "Act 48".
  const creditArg = arg("credit");
  let creditsAttached = 0;
  if (creditArg) {
    const creditType = await db.creditType.findFirst({
      where: { orgId: org.id, name: { contains: creditArg } },
    });
    if (!creditType) throw new Error(`No credit type matching "${creditArg}" in ${org.name}`);
    const sessions = await db.session.findMany({ where: { eventId: event.id }, select: { id: true } });
    for (const s of sessions) {
      await db.sessionCredit.upsert({
        where: { sessionId_creditTypeId: { sessionId: s.id, creditTypeId: creditType.id } },
        create: { sessionId: s.id, creditTypeId: creditType.id },
        update: {},
      });
      creditsAttached++;
    }
  }

  console.log(
    `Imported "${name}" (${sourceId}): ${created} sessions created, ${updated} updated` +
      (people.length ? `, ${peopleCreated} people added (${people.length} in source)` : "") +
      (creditArg ? `, credit attached to ${creditsAttached} sessions` : "") +
      `.\nEvent id: ${event.id} — open /events/${event.id}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
