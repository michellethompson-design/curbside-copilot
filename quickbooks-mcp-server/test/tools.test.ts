import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { QboClient } from '../src/qbo/client.js';
import { registerTools } from '../src/tools/register.js';
import {
  accountsPage,
  BALANCE_SHEET_BODY,
  COMPANY_INFO_BODY,
  jsonResponse,
  mockFetch,
  stubAuth,
  TEST_REALM,
} from './helpers.js';

const EXPECTED_TOOLS = [
  'qb_company_info',
  'qb_chart_of_accounts',
  'qb_balance_sheet',
  'qb_profit_and_loss_by_month',
  'qb_cash_flow',
  'qb_general_ledger',
  'qb_transaction_detail',
  'qb_ar_aging',
  'qb_ap_aging',
  'qb_open_invoices',
  'qb_open_bills',
];

function routeRequest(url: URL): Response {
  if (url.pathname.includes('/companyinfo/')) return jsonResponse(COMPANY_INFO_BODY);
  if (url.pathname.endsWith('/query')) {
    const q = url.searchParams.get('query') ?? '';
    if (q.includes('FROM Account')) {
      return jsonResponse(
        accountsPage([
          { Id: '1', Name: 'Checking', AccountType: 'Bank', AcctNum: '123456789012' },
          { Id: '2', Name: 'Visa', AccountType: 'Credit Card', AcctNum: '4111111111111111' },
          { Id: '3', Name: 'Sales', AccountType: 'Income', AcctNum: '4000' },
        ]),
      );
    }
    if (q.includes('FROM Invoice')) {
      return jsonResponse({ QueryResponse: { Invoice: [{ Id: '10', Balance: 250.5 }] } });
    }
    if (q.includes('FROM Bill')) {
      return jsonResponse({ QueryResponse: { Bill: [{ Id: '20', Balance: 99 }] } });
    }
  }
  if (url.pathname.includes('/reports/')) return jsonResponse(BALANCE_SHEET_BODY);
  return jsonResponse({ Fault: { Error: [{ Message: 'unexpected route' }] } }, 404);
}

describe('MCP tools (in-memory transport, mocked QuickBooks API)', () => {
  let client: Client;
  let server: McpServer;
  let requests: Array<{ url: URL; init: RequestInit | undefined }>;

  beforeEach(async () => {
    const { fn, calls } = mockFetch(routeRequest);
    requests = calls;
    const qbo = new QboClient({
      auth: stubAuth(),
      realmId: TEST_REALM,
      environment: 'sandbox',
      fetchFn: fn,
      retryBaseMs: 1,
      sleepFn: async () => {},
    });
    server = new McpServer({ name: 'test', version: '0.0.0' });
    registerTools(server, { client: qbo, realmId: TEST_REALM, environment: 'sandbox' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'test-client', version: '0.0.0' });
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  });

  afterEach(async () => {
    await client.close();
    await server.close();
  });

  async function callTool(name: string, args: Record<string, unknown> = {}) {
    const res = await client.callTool({ name, arguments: args });
    const content = res.content as Array<{ type: string; text: string }>;
    return { res, payload: res.isError ? null : JSON.parse(content[0]!.text) };
  }

  it('exposes exactly the 11 read-only tools, all flagged readOnlyHint', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([...EXPECTED_TOOLS].sort());
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint, `${tool.name} readOnlyHint`).toBe(true);
      expect(tool.annotations?.destructiveHint, `${tool.name} destructiveHint`).toBe(false);
    }
  });

  const META_KEYS = [
    'companyId',
    'reportStartDate',
    'reportEndDate',
    'retrievedAt',
    'accountingBasis',
    'currency',
  ];

  it('every tool response includes the required metadata envelope', async () => {
    const callArgs: Record<string, Record<string, unknown>> = {
      qb_profit_and_loss_by_month: { startDate: '2026-01-01', endDate: '2026-06-30' },
    };
    for (const name of EXPECTED_TOOLS) {
      const { res, payload } = await callTool(name, callArgs[name] ?? {});
      expect(res.isError, `${name} should succeed`).toBeFalsy();
      for (const key of META_KEYS) {
        expect(payload.meta, `${name} meta.${key}`).toHaveProperty(key);
      }
      expect(payload.meta.companyId).toBe(TEST_REALM);
      expect(payload.meta.currency).toBe('USD');
      expect(Date.parse(payload.meta.retrievedAt)).not.toBeNaN();
    }
  });

  it('report tools take period + basis from the report header', async () => {
    const { payload } = await callTool('qb_balance_sheet', { endDate: '2026-06-30' });
    expect(payload.meta.reportStartDate).toBe('2026-01-01');
    expect(payload.meta.reportEndDate).toBe('2026-06-30');
    expect(payload.meta.accountingBasis).toBe('Accrual');
  });

  it('profit and loss requests monthly columns', async () => {
    await callTool('qb_profit_and_loss_by_month', { startDate: '2026-01-01', endDate: '2026-06-30' });
    const reportCall = requests.find((r) => r.url.pathname.includes('/reports/ProfitAndLoss'));
    expect(reportCall).toBeDefined();
    expect(reportCall!.url.searchParams.get('summarize_column_by')).toBe('Month');
  });

  it('masks bank and credit-card account numbers in the chart of accounts', async () => {
    const { payload } = await callTool('qb_chart_of_accounts');
    const byId = Object.fromEntries(
      (payload.data as Array<{ Id: string; AcctNum?: string }>).map((a) => [a.Id, a]),
    );
    expect(byId['1']!.AcctNum).toBe('****9012');
    expect(byId['2']!.AcctNum).toBe('****1111');
    expect(byId['2']!.AcctNum).not.toContain('411111');
    // Ordinary GL codes are preserved.
    expect(byId['3']!.AcctNum).toBe('4000');
  });

  it('entity tools report NotApplicable basis and include pagination info', async () => {
    const { payload } = await callTool('qb_open_invoices');
    expect(payload.meta.accountingBasis).toBe('NotApplicable');
    expect(payload.pagination).toMatchObject({ complete: true, itemsFetched: 1 });
    expect(payload.data[0].Id).toBe('10');
  });

  it('rejects invalid date input via schema validation before any API call', async () => {
    const before = requests.filter((r) => r.url.pathname.includes('/reports/')).length;
    const res = await client.callTool({
      name: 'qb_balance_sheet',
      arguments: { endDate: 'June 30' },
    });
    expect(res.isError).toBe(true);
    const after = requests.filter((r) => r.url.pathname.includes('/reports/')).length;
    expect(after).toBe(before);
  });

  it('surfaces QuickBooks API faults as tool errors without raw bodies', async () => {
    requests.length = 0;
    const { fn } = mockFetch(() =>
      jsonResponse(
        { Fault: { Error: [{ Message: 'Report not available', code: '5000' }] }, SecretData: 'do-not-leak' },
        400,
      ),
    );
    const qbo = new QboClient({
      auth: stubAuth(),
      realmId: TEST_REALM,
      environment: 'sandbox',
      fetchFn: fn,
      retryBaseMs: 1,
      sleepFn: async () => {},
    });
    const failServer = new McpServer({ name: 'fail', version: '0.0.0' });
    registerTools(failServer, { client: qbo, realmId: TEST_REALM, environment: 'sandbox' });
    const [ct, st] = InMemoryTransport.createLinkedPair();
    const failClient = new Client({ name: 'fail-client', version: '0.0.0' });
    await Promise.all([failClient.connect(ct), failServer.connect(st)]);
    const res = await failClient.callTool({ name: 'qb_cash_flow', arguments: {} });
    expect(res.isError).toBe(true);
    const text = (res.content as Array<{ text: string }>)[0]!.text;
    expect(text).toContain('Report not available');
    expect(text).not.toContain('do-not-leak');
    await failClient.close();
    await failServer.close();
  });
});
