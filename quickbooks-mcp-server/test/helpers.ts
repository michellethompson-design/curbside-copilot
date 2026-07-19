import type { QboAuth } from '../src/auth/oauthClient.js';
import { QboClient, type QboClientOptions } from '../src/qbo/client.js';

export const TEST_REALM = '9341453889';

export function stubAuth(token = 'test-access-token'): QboAuth {
  return {
    getAccessToken: async () => token,
  } as unknown as QboAuth;
}

export type FetchHandler = (url: URL, init: RequestInit | undefined) => Response | Promise<Response>;

/** Records every request and delegates to a handler. */
export function mockFetch(handler: FetchHandler) {
  const calls: Array<{ url: URL; init: RequestInit | undefined }> = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof URL ? input : new URL(String(input));
    calls.push({ url, init });
    return handler(url, init);
  }) as typeof fetch;
  return { fn, calls };
}

export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', intuit_tid: 'tid-test-123', ...headers },
  });
}

export function makeClient(handler: FetchHandler, overrides: Partial<QboClientOptions> = {}) {
  const { fn, calls } = mockFetch(handler);
  const client = new QboClient({
    auth: stubAuth(),
    realmId: TEST_REALM,
    environment: 'sandbox',
    fetchFn: fn,
    retryBaseMs: 1,
    sleepFn: async () => {},
    ...overrides,
  });
  return { client, calls };
}

export const COMPANY_INFO_BODY = {
  CompanyInfo: {
    CompanyName: 'Sandbox Test Co',
    LegalName: 'Sandbox Test Co LLC',
    Country: 'US',
    CurrencyRef: { value: 'USD', name: 'United States Dollar' },
    FiscalYearStartMonth: 'January',
  },
};

export function accountsPage(accounts: unknown[], startPosition = 1) {
  return {
    QueryResponse: { Account: accounts, startPosition, maxResults: accounts.length },
  };
}

export const BALANCE_SHEET_BODY = {
  Header: {
    Time: '2026-07-19T00:00:00-07:00',
    ReportName: 'BalanceSheet',
    ReportBasis: 'Accrual',
    StartPeriod: '2026-01-01',
    EndPeriod: '2026-06-30',
    Currency: 'USD',
  },
  Columns: { Column: [] },
  Rows: { Row: [] },
};
