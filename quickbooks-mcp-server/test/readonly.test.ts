import { describe, expect, it } from 'vitest';
import {
  ALLOWED_QUERY_ENTITIES,
  ALLOWED_REPORTS,
  assertReadOnlyQuery,
} from '../src/qbo/client.js';
import { ReadOnlyViolationError } from '../src/qbo/errors.js';
import { jsonResponse, makeClient } from './helpers.js';

describe('read-only enforcement', () => {
  it('assertReadOnlyQuery accepts plain SELECT statements', () => {
    expect(() =>
      assertReadOnlyQuery("SELECT * FROM Invoice WHERE Balance > '0' STARTPOSITION 1 MAXRESULTS 1000"),
    ).not.toThrow();
  });

  it.each([
    ['UPDATE Invoice SET Balance = 0', /SELECT/i],
    ['DELETE FROM Bill', /SELECT/i],
    ["SELECT * FROM Invoice; DELETE FROM Bill", /single statement/i],
    ['SELECT * FROM Invoice WHERE Note = update', /mutation verb/i],
  ])('rejects %s', (query, msg) => {
    expect(() => assertReadOnlyQuery(query)).toThrow(ReadOnlyViolationError);
    expect(() => assertReadOnlyQuery(query)).toThrow(msg);
  });

  it('rejects entities outside the allowlist', async () => {
    const { client } = makeClient(() => jsonResponse({}));
    await expect(
      client.queryAll('Payment' as (typeof ALLOWED_QUERY_ENTITIES)[number]),
    ).rejects.toThrow(ReadOnlyViolationError);
  });

  it('rejects reports outside the allowlist', async () => {
    const { client } = makeClient(() => jsonResponse({}));
    await expect(
      client.getReport('TaxSummary' as (typeof ALLOWED_REPORTS)[number], {}),
    ).rejects.toThrow(ReadOnlyViolationError);
  });

  it('the allowlists are frozen so they cannot be widened at runtime', () => {
    expect(Object.isFrozen(ALLOWED_QUERY_ENTITIES)).toBe(true);
    expect(Object.isFrozen(ALLOWED_REPORTS)).toBe(true);
    expect(() => (ALLOWED_QUERY_ENTITIES as unknown as string[]).push('Purchase')).toThrow();
  });

  it('every request the client issues is a GET', async () => {
    const { client, calls } = makeClient((url) => {
      if (url.pathname.endsWith('/query')) {
        return jsonResponse({ QueryResponse: { Account: [] } });
      }
      return jsonResponse({ CompanyInfo: { CompanyName: 'X' } });
    });
    await client.getCompanyInfo();
    await client.queryAll('Account');
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) {
      expect((c.init?.method ?? 'GET').toUpperCase()).toBe('GET');
    }
  });

  it('non-GET requests are rejected before any network call', async () => {
    const { client, calls } = makeClient(() => jsonResponse({}));
    const anyClient = client as unknown as {
      request(path: string, params: Record<string, string>, method?: string): Promise<unknown>;
    };
    await expect(anyClient.request('/invoice', {}, 'POST')).rejects.toThrow(ReadOnlyViolationError);
    await expect(anyClient.request('/invoice', {}, 'DELETE')).rejects.toThrow(ReadOnlyViolationError);
    expect(calls).toHaveLength(0);
  });
});
