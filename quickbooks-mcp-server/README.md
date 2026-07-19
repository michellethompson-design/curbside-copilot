# QuickBooks Online read-only MCP server

A [Model Context Protocol](https://modelcontextprotocol.io) server (TypeScript,
official `@modelcontextprotocol/sdk`, stdio transport) that gives MCP clients
**strictly read-only** access to the
[QuickBooks Online Accounting API](https://developer.intuit.com/app/developer/qbo/docs/get-started)
via Intuit OAuth 2.0.

## Tools

| Tool | Source |
|---|---|
| `qb_company_info` | `GET /v3/company/{realmId}/companyinfo/{realmId}` |
| `qb_chart_of_accounts` | `Account` query (paginated); bank/credit-card numbers masked |
| `qb_balance_sheet` | `reports/BalanceSheet` |
| `qb_profit_and_loss_by_month` | `reports/ProfitAndLoss?summarize_column_by=Month` |
| `qb_cash_flow` | `reports/CashFlow` |
| `qb_general_ledger` | `reports/GeneralLedger` |
| `qb_transaction_detail` | `reports/TransactionList` |
| `qb_ar_aging` | `reports/AgedReceivables` / `AgedReceivableDetail` |
| `qb_ap_aging` | `reports/AgedPayables` / `AgedPayableDetail` |
| `qb_open_invoices` | `Invoice` query, `Balance > '0'` (paginated) |
| `qb_open_bills` | `Bill` query, `Balance > '0'` (paginated) |

Every tool response is a JSON envelope:

```jsonc
{
  "meta": {
    "companyId": "9341453889...",        // QuickBooks company (realm) ID
    "reportStartDate": "2026-01-01",
    "reportEndDate": "2026-06-30",
    "retrievedAt": "2026-07-19T03:01:22.512Z",  // data retrieval timestamp
    "accountingBasis": "Accrual",        // Cash | Accrual | CompanyDefault | NotApplicable
    "currency": "USD",
    "environment": "sandbox"
  },
  "data": { /* report or entity payload */ },
  "pagination": { "complete": true, "pagesFetched": 1, "itemsFetched": 42, "pageSize": 1000 },
  "warnings": []
}
```

For point-in-time data (company info, chart of accounts, open invoices/bills)
`reportStartDate` equals `reportEndDate` (the as-of date), and
`accountingBasis` is `NotApplicable` because raw records are not
basis-dependent. Report tools echo the basis QuickBooks actually applied
(from the report header) when available.

## Security model

**Read-only is enforced in code, not assumed.** The QuickBooks Accounting API
itself is read-write, and Intuit's OAuth model has **no read-only scope** —
`com.intuit.quickbooks.accounting` (the only scope this server ever requests,
and the minimum for the Accounting API) permits writes. So the server enforces
read-only behavior structurally:

- Every QuickBooks API call funnels through one private request method that
  **rejects any HTTP method other than GET** before a request is built
  (`src/qbo/client.ts`). The server contains no code path that issues POST,
  PUT, PATCH, or DELETE against the accounting API.
- URLs must resolve inside `https://…/v3/company/{realmId}/` for the
  configured company.
- Query statements must be a single plain `SELECT` (no `;`, no mutation
  verbs), checked by `assertReadOnlyQuery`.
- Entities (`Account`, `Invoice`, `Bill`) and report names come from
  **frozen allowlists**.
- All tools advertise `readOnlyHint: true` / `destructiveHint: false`
  [tool annotations](https://modelcontextprotocol.io/specification/2025-06-18/server/tools#tool-annotations).
- The single non-GET request in the codebase is the OAuth **token refresh**
  POST, pinned to Intuit's identity endpoint
  (`oauth.platform.intuit.com/oauth2/v1/tokens/bearer`) — it exchanges
  credentials and cannot touch company data.

**Credential handling.**

- Credentials come only from environment variables and (optionally) an
  **AES-256-GCM encrypted token store file** — never from CLI args, never
  from disk in plaintext. Intuit rotates the refresh token on every refresh,
  so the encrypted store is the recommended way to persist the newest token
  across restarts (file mode `0600`, atomic writes).
- **Logging redaction** (`src/redact.ts`): logs go to stderr only (stdout is
  the MCP transport), API response bodies are never logged at all, and
  everything that reaches the logger is passed through a redactor that strips
  access/refresh tokens, `Authorization` headers, client secrets, bank
  account numbers, routing numbers, tax IDs (EIN/SSN), and payroll
  identifiers. Errors carry Intuit's `intuit_tid` trace ID (safe, and what
  Intuit support asks for) instead of raw bodies.
- Defense in depth: chart-of-accounts results mask `AcctNum` to the last 4
  digits for Bank and Credit Card accounts, so bank account numbers don't
  transit the tool output either.
- No payroll tools are exposed, and employee-level payroll data is never
  requested.

## Setup

### 1. Create an Intuit developer app

1. Sign in at <https://developer.intuit.com> and create an app for the
   **QuickBooks Online Accounting API**.
2. Under **Keys & credentials**, note the *Client ID* and *Client Secret*
   (Development keys work against the sandbox company that Intuit
   auto-creates for your developer account).
3. Add a redirect URI: `http://localhost:8722/callback` (or your chosen
   `QB_OAUTH_REDIRECT_PORT`).

### 2. Configure environment

```bash
cd quickbooks-mcp-server
npm install
cp .env.example .env       # fill in QB_CLIENT_ID / QB_CLIENT_SECRET
```

Generate a token-store key and pick a store path:

```bash
echo "QB_TOKEN_ENCRYPTION_KEY=$(openssl rand -hex 32)" >> .env
echo "QB_TOKEN_STORE_PATH=$HOME/.config/quickbooks-mcp/tokens.enc" >> .env
```

### 3. Authorize (one time)

```bash
npm run auth
```

Open the printed URL, sign in, and pick your **sandbox** company. The helper
exchanges the code, stores the tokens encrypted, and prints the company
(realm) ID — put that in `QB_REALM_ID`. Token values are never printed.

> Alternative: if you already have a refresh token (e.g. from Intuit's OAuth
> Playground), set `QB_REFRESH_TOKEN` instead of using the token store. Note
> the rotation caveat in `.env.example`.

### 4. Build & run

```bash
npm run build
npm start        # stdio MCP server; logs on stderr
```

### 5. Register with an MCP client

Claude Desktop / Claude Code (`claude mcp add` or `mcpServers` JSON):

```jsonc
{
  "mcpServers": {
    "quickbooks-readonly": {
      "command": "node",
      "args": ["/absolute/path/to/quickbooks-mcp-server/dist/index.js"],
      "env": {
        "QB_CLIENT_ID": "…",
        "QB_CLIENT_SECRET": "…",
        "QB_REALM_ID": "…",
        "QB_ENVIRONMENT": "sandbox",
        "QB_TOKEN_STORE_PATH": "/Users/you/.config/quickbooks-mcp/tokens.enc",
        "QB_TOKEN_ENCRYPTION_KEY": "…"
      }
    }
  }
}
```

## Tests

```bash
npm test              # unit tests (mocked API) + sandbox suite (self-skips without creds)
npm run test:sandbox  # integration tests against your Intuit sandbox company
```

The sandbox suite runs only when sandbox credentials are present in the
environment, and **refuses to run** if `QB_ENVIRONMENT` is set to anything
other than `sandbox`. Unit tests cover: read-only enforcement (method guard,
SQL guard, frozen allowlists), pagination (multi-page, truncation flagging),
error handling (Fault parsing, 401 refresh-and-retry, 429/5xx backoff with
`Retry-After`, network retries), token rotation + single-flight refresh,
encrypted token store round-trips, log redaction, and the per-tool response
envelope.

## Error handling & limits

- QuickBooks `Fault` bodies are parsed into structured errors (code,
  message, detail, `intuit_tid`) and returned as MCP tool errors.
- `401` → one forced token refresh + retry; `429`/`5xx` → exponential
  backoff honoring `Retry-After` (4 attempts total); `invalid_grant` →
  clear re-authorization instructions.
- Entity queries paginate with `STARTPOSITION`/`MAXRESULTS` (1000/page) and
  stop at `QB_MAX_QUERY_PAGES` (default 10), returning
  `pagination.complete: false` plus a note instead of silently truncating.
- Requests pin `minorversion=75`, Intuit's current API baseline.

## Repository layout

```
src/
  index.ts            entrypoint (stdio transport)
  server.ts           server wiring
  config.ts           env-based configuration (zod-validated)
  redact.ts           redacting stderr logger
  auth/oauthClient.ts Intuit OAuth 2.0 refresh flow (rotating tokens)
  auth/tokenStore.ts  AES-256-GCM encrypted token store
  qbo/client.ts       GET-only API client: allowlists, pagination, retries
  qbo/errors.ts       Fault parsing, typed errors
  tools/envelope.ts   response metadata envelope
  tools/register.ts   the 11 read-only tools
scripts/get-tokens.ts one-time OAuth authorization helper
test/                 vitest unit + sandbox integration suites
```
