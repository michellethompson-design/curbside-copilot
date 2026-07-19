import { QboApiError, ReadOnlyViolationError, errorFromResponse } from './errors.js';
import type { QboAuth } from '../auth/oauthClient.js';
import { logger } from '../redact.js';

export const QBO_BASE_URLS = Object.freeze({
  sandbox: 'https://sandbox-quickbooks.api.intuit.com',
  production: 'https://quickbooks.api.intuit.com',
});

/**
 * The complete read surface this server may touch. Everything else — every
 * other entity, every other endpoint, every non-GET method — is rejected
 * before a request is built. These are frozen so nothing can widen them at
 * runtime.
 */
export const ALLOWED_QUERY_ENTITIES = Object.freeze(['Account', 'Invoice', 'Bill'] as const);
export const ALLOWED_REPORTS = Object.freeze([
  'BalanceSheet',
  'ProfitAndLoss',
  'CashFlow',
  'GeneralLedger',
  'TransactionList',
  'AgedReceivables',
  'AgedReceivableDetail',
  'AgedPayables',
  'AgedPayableDetail',
] as const);

export type QueryEntity = (typeof ALLOWED_QUERY_ENTITIES)[number];
export type ReportName = (typeof ALLOWED_REPORTS)[number];

const FORBIDDEN_SQL_VERBS =
  /\b(insert|update|delete|drop|create|alter|merge|truncate|upsert|exec|execute|grant|revoke)\b/i;

/**
 * QBO's query language is nominally SELECT-only, but we still refuse anything
 * that is not a single plain SELECT statement — defense in depth against a
 * future code path interpolating something unexpected.
 */
export function assertReadOnlyQuery(query: string): void {
  if (!/^\s*select\b/i.test(query)) {
    throw new ReadOnlyViolationError(`query must be a SELECT statement, got: ${query.slice(0, 40)}`);
  }
  if (query.includes(';')) {
    throw new ReadOnlyViolationError('query must be a single statement (no ";")');
  }
  if (FORBIDDEN_SQL_VERBS.test(query)) {
    throw new ReadOnlyViolationError('query contains a mutation verb');
  }
}

export interface PaginationInfo {
  /** False when results were truncated by the maxQueryPages safety cap. */
  complete: boolean;
  pagesFetched: number;
  itemsFetched: number;
  pageSize: number;
  note?: string;
}

export interface QueryResult<T = Record<string, unknown>> {
  items: T[];
  pagination: PaginationInfo;
}

export interface QboClientOptions {
  auth: QboAuth;
  realmId: string;
  environment: 'sandbox' | 'production';
  minorVersion?: string;
  maxQueryPages?: number;
  fetchFn?: typeof fetch;
  /** Base for retry backoff; overridable for fast tests. */
  retryBaseMs?: number;
  sleepFn?: (ms: number) => Promise<void>;
}

const QUERY_PAGE_SIZE = 1000; // QBO maximum for MAXRESULTS
const MAX_ATTEMPTS = 4;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * GET-only HTTP client for the QuickBooks Online Accounting API.
 *
 * Read-only enforcement is structural, not conventional:
 *  - the single low-level request method hard-rejects any method other
 *    than GET (`assertReadOnlyRequest`), and every API call funnels
 *    through it;
 *  - URLs must resolve inside `<base>/v3/company/<realmId>/`;
 *  - query statements must pass `assertReadOnlyQuery`;
 *  - entities and report names come from frozen allowlists.
 */
export class QboClient {
  private readonly auth: QboAuth;
  private readonly realmId: string;
  private readonly baseUrl: string;
  private readonly minorVersion: string;
  private readonly maxQueryPages: number;
  private readonly fetchFn: typeof fetch;
  private readonly retryBaseMs: number;
  private readonly sleepFn: (ms: number) => Promise<void>;

  constructor(opts: QboClientOptions) {
    this.auth = opts.auth;
    this.realmId = opts.realmId;
    this.baseUrl = QBO_BASE_URLS[opts.environment];
    this.minorVersion = opts.minorVersion ?? '75';
    this.maxQueryPages = opts.maxQueryPages ?? 10;
    this.fetchFn = opts.fetchFn ?? globalThis.fetch.bind(globalThis);
    this.retryBaseMs = opts.retryBaseMs ?? 500;
    this.sleepFn = opts.sleepFn ?? sleep;
  }

  /** Rejects anything that is not a GET inside this company's read surface. */
  private assertReadOnlyRequest(method: string, url: URL): void {
    if (method.toUpperCase() !== 'GET') {
      throw new ReadOnlyViolationError(
        `attempted ${method.toUpperCase()} request; this server only issues GET requests to the QuickBooks API`,
      );
    }
    const prefix = `${this.baseUrl}/v3/company/${encodeURIComponent(this.realmId)}/`;
    if (!url.href.startsWith(prefix)) {
      throw new ReadOnlyViolationError(`URL ${url.origin}${url.pathname} is outside the allowed read surface`);
    }
  }

  /** The single funnel for every QuickBooks API request. */
  private async request(path: string, params: Record<string, string>, method = 'GET'): Promise<unknown> {
    const url = new URL(`${this.baseUrl}/v3/company/${encodeURIComponent(this.realmId)}${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set('minorversion', this.minorVersion);
    this.assertReadOnlyRequest(method, url);

    let lastError: QboApiError | null = null;
    let forcedRefresh = false;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const token = await this.auth.getAccessToken(forcedRefresh);
      forcedRefresh = false;
      const started = Date.now();
      let res: Response;
      try {
        res = await this.fetchFn(url, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
      } catch (err) {
        lastError = new QboApiError(
          `Network error calling QuickBooks API: ${err instanceof Error ? err.message : 'unknown'}`,
          'network',
        );
        if (attempt < MAX_ATTEMPTS) {
          await this.sleepFn(this.retryBaseMs * 2 ** (attempt - 1));
          continue;
        }
        throw lastError;
      }
      const intuitTid = res.headers.get('intuit_tid') ?? undefined;
      // Log request metadata only — never response bodies (they can contain
      // account numbers and other sensitive financial data).
      logger.info('QBO request', {
        method: 'GET',
        path,
        status: res.status,
        ms: Date.now() - started,
        intuitTid,
      });

      if (res.ok) {
        try {
          return (await res.json()) as unknown;
        } catch {
          throw new QboApiError('QuickBooks API returned unparseable JSON', 'server', res.status, [], intuitTid);
        }
      }

      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        // non-JSON error body; proceed with status-only error
      }
      lastError = errorFromResponse(res.status, body, intuitTid);

      if (res.status === 401 && attempt < MAX_ATTEMPTS) {
        // Access token likely stale — force one refresh and retry.
        forcedRefresh = true;
        continue;
      }
      if ((res.status === 429 || res.status >= 500) && attempt < MAX_ATTEMPTS) {
        const retryAfter = Number(res.headers.get('retry-after'));
        const delay =
          Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : this.retryBaseMs * 2 ** (attempt - 1);
        await this.sleepFn(delay);
        continue;
      }
      throw lastError;
    }
    throw lastError ?? new QboApiError('QuickBooks API request failed', 'server');
  }

  /** GET /v3/company/{realmId}/companyinfo/{realmId} */
  async getCompanyInfo(): Promise<Record<string, unknown>> {
    const data = (await this.request(`/companyinfo/${encodeURIComponent(this.realmId)}`, {})) as {
      CompanyInfo?: Record<string, unknown>;
    };
    if (!data.CompanyInfo) {
      throw new QboApiError('CompanyInfo missing from response', 'server');
    }
    return data.CompanyInfo;
  }

  /**
   * Runs a paginated entity query (STARTPOSITION/MAXRESULTS loop) for an
   * allowlisted entity. Stops early at maxQueryPages and flags the result
   * as incomplete rather than silently truncating.
   */
  async queryAll<T = Record<string, unknown>>(
    entity: QueryEntity,
    where?: string,
    orderBy?: string,
  ): Promise<QueryResult<T>> {
    if (!ALLOWED_QUERY_ENTITIES.includes(entity)) {
      throw new ReadOnlyViolationError(`entity "${entity}" is not in the read allowlist`);
    }
    const items: T[] = [];
    let startPosition = 1;
    let pagesFetched = 0;
    let complete = true;
    for (;;) {
      if (pagesFetched >= this.maxQueryPages) {
        complete = false;
        break;
      }
      const clauses = [
        `SELECT * FROM ${entity}`,
        where ? `WHERE ${where}` : '',
        orderBy ? `ORDERBY ${orderBy}` : '',
        `STARTPOSITION ${startPosition} MAXRESULTS ${QUERY_PAGE_SIZE}`,
      ].filter(Boolean);
      const query = clauses.join(' ');
      assertReadOnlyQuery(query);
      const data = (await this.request('/query', { query })) as {
        QueryResponse?: Record<string, unknown> & { maxResults?: number };
      };
      const batch = (data.QueryResponse?.[entity] as T[] | undefined) ?? [];
      items.push(...batch);
      pagesFetched++;
      if (batch.length < QUERY_PAGE_SIZE) break;
      startPosition += batch.length;
    }
    return {
      items,
      pagination: {
        complete,
        pagesFetched,
        itemsFetched: items.length,
        pageSize: QUERY_PAGE_SIZE,
        ...(complete
          ? {}
          : {
              note: `Results truncated at ${this.maxQueryPages} pages (${items.length} items). Raise QB_MAX_QUERY_PAGES or narrow the query.`,
            }),
      },
    };
  }

  /** GET /v3/company/{realmId}/reports/{report} with undefined params dropped. */
  async getReport(
    report: ReportName,
    params: Record<string, string | undefined>,
  ): Promise<Record<string, unknown>> {
    if (!ALLOWED_REPORTS.includes(report)) {
      throw new ReadOnlyViolationError(`report "${report}" is not in the read allowlist`);
    }
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') clean[k] = v;
    }
    return (await this.request(`/reports/${report}`, clean)) as Record<string, unknown>;
  }
}
