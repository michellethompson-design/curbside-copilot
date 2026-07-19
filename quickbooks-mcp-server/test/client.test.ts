import { describe, expect, it, vi } from 'vitest';
import { QboApiError } from '../src/qbo/errors.js';
import { QboAuth } from '../src/auth/oauthClient.js';
import { InMemoryTokenStore } from '../src/auth/tokenStore.js';
import { QboClient } from '../src/qbo/client.js';
import { jsonResponse, makeClient, stubAuth, TEST_REALM } from './helpers.js';

function invoicePage(count: number, startId: number) {
  return {
    QueryResponse: {
      Invoice: Array.from({ length: count }, (_, i) => ({ Id: String(startId + i), Balance: 10 })),
      maxResults: count,
    },
  };
}

describe('pagination', () => {
  it('follows STARTPOSITION pages until a short page and reports complete', async () => {
    const seenStarts: number[] = [];
    const { client } = makeClient((url) => {
      const q = url.searchParams.get('query') ?? '';
      const start = Number(/STARTPOSITION (\d+)/.exec(q)?.[1]);
      seenStarts.push(start);
      return jsonResponse(start === 1 ? invoicePage(1000, 1) : invoicePage(40, 1001));
    });
    const result = await client.queryAll('Invoice', "Balance > '0'");
    expect(seenStarts).toEqual([1, 1001]);
    expect(result.items).toHaveLength(1040);
    expect(result.pagination).toMatchObject({ complete: true, pagesFetched: 2, itemsFetched: 1040 });
  });

  it('stops at maxQueryPages and flags the result incomplete with a note', async () => {
    const { client } = makeClient(
      (url) => {
        const q = url.searchParams.get('query') ?? '';
        const start = Number(/STARTPOSITION (\d+)/.exec(q)?.[1]);
        return jsonResponse(invoicePage(1000, start));
      },
      { maxQueryPages: 2 },
    );
    const result = await client.queryAll('Invoice');
    expect(result.items).toHaveLength(2000);
    expect(result.pagination.complete).toBe(false);
    expect(result.pagination.note).toMatch(/truncated/i);
  });

  it('handles an empty query response', async () => {
    const { client } = makeClient(() => jsonResponse({ QueryResponse: {} }));
    const result = await client.queryAll('Bill');
    expect(result.items).toEqual([]);
    expect(result.pagination).toMatchObject({ complete: true, itemsFetched: 0 });
  });
});

describe('API error handling', () => {
  it('parses QuickBooks Fault bodies into structured errors with intuit_tid', async () => {
    const { client } = makeClient(() =>
      jsonResponse(
        {
          Fault: {
            type: 'ValidationFault',
            Error: [{ Message: 'Invalid query', Detail: 'Property foo not found', code: '4000' }],
          },
        },
        400,
      ),
    );
    const err = (await client.getReport('BalanceSheet', {}).catch((e) => e)) as QboApiError;
    expect(err).toBeInstanceOf(QboApiError);
    expect(err.kind).toBe('validation');
    expect(err.status).toBe(400);
    expect(err.faults[0]).toMatchObject({ code: '4000', message: 'Invalid query' });
    expect(err.intuitTid).toBe('tid-test-123');
  });

  it('retries 429 responses honoring Retry-After, then succeeds', async () => {
    let attempts = 0;
    const delays: number[] = [];
    const { client } = makeClient(
      () => {
        attempts++;
        if (attempts < 3) {
          return jsonResponse({ Fault: { Error: [{ Message: 'Throttled', code: '3001' }] } }, 429, {
            'retry-after': '0',
          });
        }
        return jsonResponse({ QueryResponse: { Account: [] } });
      },
      { sleepFn: async (ms) => void delays.push(ms) },
    );
    const result = await client.queryAll('Account');
    expect(attempts).toBe(3);
    expect(result.pagination.complete).toBe(true);
  });

  it('gives up on persistent 429 with a rate_limit error', async () => {
    const { client } = makeClient(() => jsonResponse({ Fault: { Error: [{ code: '3001' }] } }, 429));
    const err = (await client.queryAll('Account').catch((e) => e)) as QboApiError;
    expect(err.kind).toBe('rate_limit');
  });

  it('retries 5xx errors and surfaces a server error after exhaustion', async () => {
    let attempts = 0;
    const { client } = makeClient(() => {
      attempts++;
      return jsonResponse({ Fault: { Error: [{ Message: 'boom' }] } }, 502);
    });
    const err = (await client.getCompanyInfo().catch((e) => e)) as QboApiError;
    expect(err.kind).toBe('server');
    expect(attempts).toBe(4);
  });

  it('on 401, forces a token refresh and retries once', async () => {
    let apiCalls = 0;
    let refreshes = 0;
    const authFetch = (async () => {
      refreshes++;
      return jsonResponse({
        access_token: `fresh-${refreshes}`,
        refresh_token: 'rotated-refresh',
        expires_in: 3600,
        token_type: 'bearer',
      });
    }) as typeof fetch;
    const auth = new QboAuth({
      clientId: 'id',
      clientSecret: 'secret',
      store: new InMemoryTokenStore(),
      initialRefreshToken: 'seed-refresh',
      fetchFn: authFetch,
    });
    const client = new QboClient({
      auth,
      realmId: TEST_REALM,
      environment: 'sandbox',
      retryBaseMs: 1,
      sleepFn: async () => {},
      fetchFn: (async (_url: RequestInfo | URL, init?: RequestInit) => {
        apiCalls++;
        const authHeader = (init?.headers as Record<string, string>).Authorization;
        if (authHeader === 'Bearer fresh-1' && apiCalls === 1) {
          return jsonResponse({ Fault: { Error: [{ Message: 'Token expired', code: '3200' }] } }, 401);
        }
        return jsonResponse({ CompanyInfo: { CompanyName: 'Recovered' } });
      }) as typeof fetch,
    });
    const info = await client.getCompanyInfo();
    expect(info.CompanyName).toBe('Recovered');
    expect(apiCalls).toBe(2);
    expect(refreshes).toBe(2);
  });

  it('retries network failures with backoff', async () => {
    let attempts = 0;
    const { client } = makeClient(() => {
      attempts++;
      if (attempts < 2) throw new TypeError('fetch failed');
      return jsonResponse({ CompanyInfo: { CompanyName: 'Back online' } });
    });
    const info = await client.getCompanyInfo();
    expect(info.CompanyName).toBe('Back online');
    expect(attempts).toBe(2);
  });
});

describe('request construction', () => {
  it('always sends minorversion and Accept: application/json', async () => {
    const { client, calls } = makeClient(() => jsonResponse({ CompanyInfo: {} }), {
      minorVersion: '75',
    });
    await client.getCompanyInfo();
    const call = calls[0]!;
    expect(call.url.searchParams.get('minorversion')).toBe('75');
    expect((call.init?.headers as Record<string, string>).Accept).toBe('application/json');
  });

  it('drops undefined report params', async () => {
    const { client, calls } = makeClient(() => jsonResponse({ Header: {} }));
    await client.getReport('CashFlow', { start_date: '2026-01-01', end_date: undefined });
    const url = calls[0]!.url;
    expect(url.searchParams.get('start_date')).toBe('2026-01-01');
    expect(url.searchParams.has('end_date')).toBe(false);
  });
});

describe('auth token rotation', () => {
  it('persists rotated refresh tokens to the store and single-flights refreshes', async () => {
    const store = new InMemoryTokenStore();
    let refreshes = 0;
    const auth = new QboAuth({
      clientId: 'id',
      clientSecret: 'secret',
      store,
      initialRefreshToken: 'seed',
      fetchFn: (async () => {
        refreshes++;
        await new Promise((r) => setTimeout(r, 5));
        return jsonResponse({
          access_token: 'at-1',
          refresh_token: 'rotated-1',
          expires_in: 3600,
          x_refresh_token_expires_in: 8_640_000,
          token_type: 'bearer',
        });
      }) as typeof fetch,
    });
    const [a, b] = await Promise.all([auth.getAccessToken(), auth.getAccessToken()]);
    expect(a).toBe('at-1');
    expect(b).toBe('at-1');
    expect(refreshes).toBe(1);
    expect(store.load()?.refreshToken).toBe('rotated-1');
  });

  it('reports invalid_grant as re-auth required without leaking token values', async () => {
    const auth = new QboAuth({
      clientId: 'id',
      clientSecret: 'secret',
      store: new InMemoryTokenStore(),
      initialRefreshToken: 'seed-token-value',
      fetchFn: (async () =>
        new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 })) as typeof fetch,
    });
    const err = (await auth.getAccessToken().catch((e) => e)) as Error;
    expect(err.message).toMatch(/invalid_grant|re-authorize/i);
    expect(err.message).not.toContain('seed-token-value');
  });
});
