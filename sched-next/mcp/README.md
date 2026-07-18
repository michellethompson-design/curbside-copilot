# Sched Next MCP server

Read-only MCP wrapper over the Sched Next REST API. No logic of its own —
every tool is one HTTP call against the same endpoints the web app uses.

Tools: `list_events`, `get_schedule`, `get_person_transcript`,
`get_compliance_report`, `find_people_missing_credits`.

## Connect it to Claude

Start the app first (`npm run dev`), then register the server.

**Claude Code** — from the `sched-next/` directory:

```bash
claude mcp add sched-next -- npx tsx mcp/server.ts
```

or drop a `.mcp.json` at the repo root:

```json
{
  "mcpServers": {
    "sched-next": {
      "command": "npx",
      "args": ["tsx", "mcp/server.ts"],
      "env": { "BASE_URL": "http://localhost:3000" }
    }
  }
}
```

**Claude Desktop** — add to `claude_desktop_config.json` (Settings →
Developer → Edit Config), with the absolute path to this directory:

```json
{
  "mcpServers": {
    "sched-next": {
      "command": "npx",
      "args": ["tsx", "/ABSOLUTE/PATH/TO/sched-next/mcp/server.ts"],
      "env": { "BASE_URL": "http://localhost:3000" }
    }
  }
}
```

## The demo beat

> "Claude, who still needs two more Act 48 hours before the June deadline?"

Claude calls `list_events` to find the district, then
`find_people_missing_credits` with the Act 48 credit type and the deadline
window, and answers with names and shortfalls — live against the same API the
schedule page renders from. `scripts/verify-mcp.ts` runs that exact tool
sequence over stdio and checks the numbers against the database.
