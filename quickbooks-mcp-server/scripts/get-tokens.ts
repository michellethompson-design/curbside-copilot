#!/usr/bin/env tsx
/**
 * One-time interactive authorization helper.
 *
 * Prints the Intuit consent URL, catches the redirect on localhost,
 * exchanges the authorization code for tokens, and stores them in the
 * encrypted token store (QB_TOKEN_STORE_PATH + QB_TOKEN_ENCRYPTION_KEY).
 *
 * The redirect URI (http://localhost:<port>/callback) must be registered
 * in your Intuit app's "Redirect URIs" first.
 *
 * Requests only the com.intuit.quickbooks.accounting scope — the minimum
 * for the Accounting API. See README.md → Security model.
 */
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { buildAuthorizeUrl, INTUIT_TOKEN_URL } from '../src/auth/oauthClient.js';
import { EncryptedFileTokenStore, type TokenSet } from '../src/auth/tokenStore.js';

const clientId = process.env.QB_CLIENT_ID;
const clientSecret = process.env.QB_CLIENT_SECRET;
const storePath = process.env.QB_TOKEN_STORE_PATH;
const storeKey = process.env.QB_TOKEN_ENCRYPTION_KEY;
const port = Number(process.env.QB_OAUTH_REDIRECT_PORT ?? 8722);

if (!clientId || !clientSecret) {
  console.error('Set QB_CLIENT_ID and QB_CLIENT_SECRET first (see .env.example).');
  process.exit(1);
}
if (!storePath || !storeKey) {
  console.error(
    'Set QB_TOKEN_STORE_PATH and QB_TOKEN_ENCRYPTION_KEY so tokens can be stored encrypted.\n' +
      'Generate a key with:  openssl rand -hex 32',
  );
  process.exit(1);
}

const store = new EncryptedFileTokenStore(storePath, EncryptedFileTokenStore.keyFromString(storeKey));
const redirectUri = `http://localhost:${port}/callback`;
const state = randomBytes(16).toString('hex');

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);
  if (url.pathname !== '/callback') {
    res.writeHead(404).end();
    return;
  }
  try {
    if (url.searchParams.get('state') !== state) {
      throw new Error('State mismatch — possible CSRF; restart the flow.');
    }
    const code = url.searchParams.get('code');
    const realmId = url.searchParams.get('realmId');
    if (!code) throw new Error(`Intuit returned no code (error: ${url.searchParams.get('error') ?? 'unknown'})`);

    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenRes = await fetch(INTUIT_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
    });
    if (!tokenRes.ok) throw new Error(`Token exchange failed: HTTP ${tokenRes.status}`);
    const json = (await tokenRes.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      x_refresh_token_expires_in?: number;
    };
    const tokens: TokenSet = {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      accessTokenExpiresAt: Date.now() + json.expires_in * 1000,
      refreshTokenExpiresAt: json.x_refresh_token_expires_in
        ? Date.now() + json.x_refresh_token_expires_in * 1000
        : undefined,
    };
    store.save(tokens);

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Authorized. Tokens stored encrypted. You can close this tab.');
    // Token values are intentionally never printed.
    console.log(`\nSuccess. Tokens stored encrypted at: ${storePath}`);
    if (realmId) console.log(`Company (realm) ID: ${realmId}  → set QB_REALM_ID=${realmId}`);
    console.log('You can now start the MCP server.');
    server.close();
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Authorization failed — see terminal.');
    console.error(err instanceof Error ? err.message : String(err));
    server.close();
    process.exitCode = 1;
  }
});

server.listen(port, () => {
  console.log('Open this URL in a browser and approve access for your (sandbox) company:\n');
  console.log(buildAuthorizeUrl(clientId, redirectUri, state));
  console.log(`\nWaiting for the redirect on ${redirectUri} …`);
  console.log(`(${redirectUri} must be listed under Redirect URIs in your Intuit app settings.)`);
});
