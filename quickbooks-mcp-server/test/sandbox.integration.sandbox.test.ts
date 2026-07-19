/**
 * Integration tests against a real Intuit sandbox company.
 *
 * These self-skip unless sandbox credentials are present in the environment:
 *   QB_CLIENT_ID, QB_CLIENT_SECRET, QB_REALM_ID, and either QB_REFRESH_TOKEN
 *   or QB_TOKEN_STORE_PATH + QB_TOKEN_ENCRYPTION_KEY.
 *
 * As a safety interlock they refuse to run against production:
 * QB_ENVIRONMENT must be unset or "sandbox".
 *
 * Run with:  npm run test:sandbox
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig, type Config } from '../src/config.js';
import { createServer } from '../src/server.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const env = process.env;
const haveCreds = Boolean(
  env.QB_CLIENT_ID &&
    env.QB_CLIENT_SECRET &&
    env.QB_REALM_ID &&
    (env.QB_REFRESH_TOKEN || (env.QB_TOKEN_STORE_PATH && env.QB_TOKEN_ENCRYPTION_KEY)),
);

const META_KEYS = [
  'companyId',
  'reportStartDate',
  'reportEndDate',
  'retrievedAt',
  'accountingBasis',
  'currency',
] as const;

describe.skipIf(!haveCreds)('Intuit sandbox integration', () => {
  let config: Config;
  let server: McpServer;
  let client: Client;

  beforeAll(async () => {
    if (env.QB_ENVIRONMENT && env.QB_ENVIRONMENT !== 'sandbox') {
      throw new Error(
        `Refusing to run integration tests against QB_ENVIRONMENT=${env.QB_ENVIRONMENT}; use a sandbox company.`,
      );
    }
    config = loadConfig({ ...env, QB_ENVIRONMENT: 'sandbox' });
    server = createServer(config);
    client = new Client({ name: 'sandbox-test-client', version: '0.0.0' });
    const [ct, st] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(ct), server.connect(st)]);
  });

  afterAll(async () => {
    await client?.close();
    await server?.close();
  });

  async function call(name: string, args: Record<string, unknown> = {}) {
    const res = await client.callTool({ name, arguments: args });
    const content = res.content as Array<{ type: string; text: string }>;
    expect(res.isError, `${name} failed: ${content?.[0]?.text}`).toBeFalsy();
    const payload = JSON.parse(content[0]!.text);
    for (const key of META_KEYS) {
      expect(payload.meta, `${name} meta.${key}`).toHaveProperty(key);
    }
    expect(payload.meta.companyId).toBe(config.realmId);
    return payload;
  }

  it('lists all 11 tools with readOnlyHint', async () => {
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(11);
    for (const t of tools) expect(t.annotations?.readOnlyHint).toBe(true);
  });

  it('fetches company info', async () => {
    const payload = await call('qb_company_info');
    expect(payload.data.CompanyName).toBeTruthy();
    expect(payload.meta.accountingBasis).toBe('NotApplicable');
  });

  it('fetches the chart of accounts with pagination metadata', async () => {
    const payload = await call('qb_chart_of_accounts');
    expect(Array.isArray(payload.data)).toBe(true);
    expect(payload.data.length).toBeGreaterThan(0);
    expect(payload.pagination.complete).toBe(true);
    for (const account of payload.data) {
      if ((account.AccountType === 'Bank' || account.AccountType === 'Credit Card') && account.AcctNum) {
        expect(account.AcctNum).toMatch(/^\*{4}/);
      }
    }
  });

  it('fetches a balance sheet with header-derived period', async () => {
    const payload = await call('qb_balance_sheet', { endDate: '2026-06-30' });
    expect(payload.data.Header?.ReportName).toBe('BalanceSheet');
    expect(payload.meta.reportEndDate).toBeTruthy();
  });

  it('fetches profit & loss summarized by month', async () => {
    const payload = await call('qb_profit_and_loss_by_month', {
      startDate: '2026-01-01',
      endDate: '2026-06-30',
    });
    expect(payload.data.Columns?.Column?.length).toBeGreaterThan(1);
  });

  it('fetches the statement of cash flows', async () => {
    const payload = await call('qb_cash_flow', { startDate: '2026-01-01', endDate: '2026-06-30' });
    expect(payload.data.Header?.ReportName).toBe('CashFlow');
  });

  it('fetches the general ledger', async () => {
    const payload = await call('qb_general_ledger', {
      startDate: '2026-01-01',
      endDate: '2026-06-30',
    });
    expect(payload.data.Header?.ReportName).toBe('GeneralLedger');
  });

  it('fetches AR and AP aging', async () => {
    const ar = await call('qb_ar_aging');
    expect(ar.data.Header?.ReportName).toMatch(/AgedReceivable/i);
    const ap = await call('qb_ap_aging', { detail: true });
    expect(ap.data.Header?.ReportName).toMatch(/AgedPayable/i);
  });

  it('fetches open invoices and open bills', async () => {
    const invoices = await call('qb_open_invoices');
    expect(Array.isArray(invoices.data)).toBe(true);
    expect(invoices.pagination).toBeDefined();
    const bills = await call('qb_open_bills');
    expect(Array.isArray(bills.data)).toBe(true);
  });
});

// Make the file report a skipped suite (not "no tests") when creds are absent.
describe.skipIf(haveCreds)('Intuit sandbox integration (skipped)', () => {
  it('skipped — set sandbox credentials to enable (see README)', () => {
    expect(haveCreds).toBe(false);
  });
});
