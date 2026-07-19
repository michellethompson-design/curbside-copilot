import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Config } from './config.js';
import { QboAuth } from './auth/oauthClient.js';
import {
  EncryptedFileTokenStore,
  InMemoryTokenStore,
  type TokenStore,
} from './auth/tokenStore.js';
import { QboClient } from './qbo/client.js';
import { registerTools } from './tools/register.js';
import { logger } from './redact.js';

export const SERVER_NAME = 'quickbooks-readonly';
export const SERVER_VERSION = '0.1.0';

export function buildTokenStore(config: Config): TokenStore {
  if (config.tokenStorePath && config.tokenEncryptionKey) {
    return new EncryptedFileTokenStore(
      config.tokenStorePath,
      EncryptedFileTokenStore.keyFromString(config.tokenEncryptionKey),
    );
  }
  logger.warn(
    'No encrypted token store configured (QB_TOKEN_STORE_PATH); rotated refresh tokens will be kept in memory only. ' +
      'Intuit rotates refresh tokens on every refresh, so after this process exits QB_REFRESH_TOKEN may be stale — an encrypted store is recommended.',
  );
  return new InMemoryTokenStore();
}

export function createServer(config: Config): McpServer {
  const store = buildTokenStore(config);
  const auth = new QboAuth({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    store,
    initialRefreshToken: config.refreshToken,
  });
  const client = new QboClient({
    auth,
    realmId: config.realmId,
    environment: config.environment,
    minorVersion: config.minorVersion,
    maxQueryPages: config.maxQueryPages,
  });
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  registerTools(server, {
    client,
    realmId: config.realmId,
    environment: config.environment,
  });
  return server;
}
