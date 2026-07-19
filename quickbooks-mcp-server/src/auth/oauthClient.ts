import { logger } from '../redact.js';
import type { TokenSet, TokenStore } from './tokenStore.js';

/**
 * Intuit OAuth 2.0 endpoints (see https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0).
 */
export const INTUIT_AUTHORIZE_URL = 'https://appcenter.intuit.com/connect/oauth2';
export const INTUIT_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

/**
 * Minimum scopes: `com.intuit.quickbooks.accounting` is the narrowest scope
 * Intuit offers for the Accounting API — there is no finer-grained
 * "read-only" scope in Intuit's OAuth model. We request nothing else (no
 * openid/profile/email, no payments, no payroll). Because the scope itself
 * still permits writes, read-only behavior is enforced in code by the HTTP
 * client (see qbo/client.ts).
 */
export const REQUIRED_SCOPES: readonly string[] = Object.freeze(['com.intuit.quickbooks.accounting']);

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly reauthRequired = false,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

interface TokenEndpointResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  x_refresh_token_expires_in?: number;
  token_type: string;
}

export interface QboAuthOptions {
  clientId: string;
  clientSecret: string;
  store: TokenStore;
  /** Seed refresh token from the environment; the store's copy (if any) wins because it is newer. */
  initialRefreshToken?: string;
  fetchFn?: typeof fetch;
}

/** How long before expiry we proactively refresh. */
const EXPIRY_MARGIN_MS = 60_000;

/**
 * Manages the Intuit OAuth 2.0 refresh-token flow.
 *
 * Intuit rotates the refresh token on every exchange, so each successful
 * refresh persists the new pair via the TokenStore. Token values are never
 * logged and never included in error messages.
 */
export class QboAuth {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly store: TokenStore;
  private readonly fetchFn: typeof fetch;
  private tokens: TokenSet | null;
  private refreshInFlight: Promise<string> | null = null;

  constructor(opts: QboAuthOptions) {
    this.clientId = opts.clientId;
    this.clientSecret = opts.clientSecret;
    this.store = opts.store;
    this.fetchFn = opts.fetchFn ?? globalThis.fetch.bind(globalThis);
    const stored = this.store.load();
    if (stored) {
      this.tokens = stored;
    } else if (opts.initialRefreshToken) {
      this.tokens = {
        accessToken: '',
        refreshToken: opts.initialRefreshToken,
        accessTokenExpiresAt: 0,
      };
    } else {
      this.tokens = null;
    }
  }

  /** Returns a valid access token, refreshing (single-flight) when needed. */
  async getAccessToken(forceRefresh = false): Promise<string> {
    if (
      !forceRefresh &&
      this.tokens?.accessToken &&
      Date.now() < this.tokens.accessTokenExpiresAt - EXPIRY_MARGIN_MS
    ) {
      return this.tokens.accessToken;
    }
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.refresh().finally(() => {
        this.refreshInFlight = null;
      });
    }
    return this.refreshInFlight;
  }

  private async refresh(): Promise<string> {
    if (!this.tokens?.refreshToken) {
      throw new AuthError(
        'No refresh token available. Run `npm run auth` (or set QB_REFRESH_TOKEN) to authorize the app.',
        true,
      );
    }
    // The token endpoint is the single non-GET request this server ever
    // makes. It targets Intuit's identity service, not the accounting data
    // API, and is pinned to INTUIT_TOKEN_URL — it cannot touch company data.
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.tokens.refreshToken,
    });
    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    let res: Response;
    try {
      res = await this.fetchFn(INTUIT_TOKEN_URL, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body,
      });
    } catch (err) {
      throw new AuthError(
        `Network error reaching the Intuit token endpoint: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
    if (!res.ok) {
      let errorCode = 'unknown_error';
      try {
        const json = (await res.json()) as { error?: string };
        if (json.error) errorCode = json.error;
      } catch {
        // ignore unparseable error body; never log it
      }
      if (errorCode === 'invalid_grant') {
        this.tokens = null;
        throw new AuthError(
          'The refresh token was rejected (invalid_grant) — it has expired or been revoked. Re-authorize with `npm run auth`.',
          true,
        );
      }
      throw new AuthError(`Token refresh failed (HTTP ${res.status}, ${errorCode}).`);
    }
    const json = (await res.json()) as TokenEndpointResponse;
    this.tokens = {
      accessToken: json.access_token,
      // Intuit rotates refresh tokens; fall back to the current one if absent.
      refreshToken: json.refresh_token ?? this.tokens.refreshToken,
      accessTokenExpiresAt: Date.now() + json.expires_in * 1000,
      refreshTokenExpiresAt: json.x_refresh_token_expires_in
        ? Date.now() + json.x_refresh_token_expires_in * 1000
        : this.tokens.refreshTokenExpiresAt,
    };
    this.store.save(this.tokens);
    logger.info('Refreshed QuickBooks access token', {
      store: this.store.describe(),
      accessTokenExpiresAt: new Date(this.tokens.accessTokenExpiresAt).toISOString(),
    });
    return this.tokens.accessToken;
  }
}

/** Builds the user-consent URL for the one-time authorization step. */
export function buildAuthorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const url = new URL(INTUIT_AUTHORIZE_URL);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', REQUIRED_SCOPES.join(' '));
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  return url.toString();
}
