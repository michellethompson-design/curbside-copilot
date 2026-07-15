/**
 * Sched Next MCP server — a thin, read-only wrapper over the REST API.
 *
 * Deliberately contains no logic of its own (CLAUDE.md): every tool is one
 * fetch against the same endpoints the web app and any integration use. If a
 * tool needs something the API can't answer, the API grows — never this file.
 *
 * Run: npm run mcp   (BASE_URL defaults to http://localhost:3000)
 * Claude config: see mcp/README.md.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

async function get(path: string, params: Record<string, string | number | undefined> = {}) {
  const url = new URL(path, BASE_URL);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }
  const res = await fetch(url);
  const body = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${body.slice(0, 300)}`);
  return body;
}

function asText(body: string) {
  return { content: [{ type: "text" as const, text: body }] };
}

const server = new McpServer({ name: "sched-next", version: "0.1.0" });

server.tool(
  "list_events",
  "List organizations and their events (id, name, dates, venue, session count). Call this first to discover org and event ids.",
  {},
  async () => {
    const orgs = JSON.parse(await get("/api/orgs"));
    const withEvents = await Promise.all(
      orgs.orgs.map(async (o: { id: string; name: string }) => ({
        ...o,
        events: JSON.parse(await get(`/api/orgs/${o.id}/events`)).events,
      })),
    );
    return asText(JSON.stringify({ orgs: withEvents }, null, 2));
  },
);

server.tool(
  "get_schedule",
  "Full schedule for an event: sessions with times, tracks, rooms, speakers, and the credit each session offers.",
  { eventId: z.string().describe("Event id from list_events") },
  async ({ eventId }) => asText(await get(`/api/events/${eventId}/schedule`)),
);

server.tool(
  "get_person_transcript",
  "A person's credit transcript across all events and years, with per-type totals net of corrections. Optionally filter by calendar year or credit type id.",
  {
    personId: z.string().describe("Person id"),
    year: z.number().optional().describe("Calendar year, e.g. 2026"),
    creditTypeId: z.string().optional(),
  },
  async ({ personId, year, creditTypeId }) =>
    asText(await get(`/api/people/${personId}/transcript`, { year, creditTypeId })),
);

server.tool(
  "get_compliance_report",
  "Org-wide totals of a credit type per person (net of corrections), optionally within a date range. Identify the credit type by id or by name substring (e.g. 'Act 48').",
  {
    orgId: z.string().describe("Org id from list_events"),
    creditTypeId: z.string().optional(),
    creditType: z.string().optional().describe("Credit type name substring, e.g. 'Act 48'"),
    from: z.string().optional().describe("ISO date lower bound"),
    to: z.string().optional().describe("ISO date upper bound"),
  },
  async ({ orgId, creditTypeId, creditType, from, to }) =>
    asText(await get(`/api/orgs/${orgId}/compliance/report`, { creditTypeId, creditType, from, to })),
);

server.tool(
  "find_people_missing_credits",
  "People below a credit-unit threshold for a credit type, optionally within a date range — including people with no credit at all. Returns each person's shortfall, sorted worst-first.",
  {
    orgId: z.string().describe("Org id from list_events"),
    threshold: z.number().describe("Minimum required units, e.g. 6"),
    creditTypeId: z.string().optional(),
    creditType: z.string().optional().describe("Credit type name substring, e.g. 'Act 48'"),
    from: z.string().optional().describe("ISO date lower bound"),
    to: z.string().optional().describe("ISO date upper bound"),
    limit: z.number().optional().describe("Max people to return (default 100)"),
  },
  async ({ orgId, threshold, creditTypeId, creditType, from, to, limit }) =>
    asText(
      await get(`/api/orgs/${orgId}/compliance/missing`, {
        threshold,
        creditTypeId,
        creditType,
        from,
        to,
        limit,
      }),
    ),
);

async function start() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`sched-next MCP server on stdio, proxying ${BASE_URL}`);
}

start().catch((e) => {
  console.error(e);
  process.exit(1);
});
