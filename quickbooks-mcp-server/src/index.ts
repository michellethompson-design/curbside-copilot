#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { createServer, SERVER_NAME, SERVER_VERSION } from './server.js';
import { logger } from './redact.js';

async function main(): Promise<void> {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
  const server = createServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info(`${SERVER_NAME} v${SERVER_VERSION} connected`, {
    environment: config.environment,
    companyId: config.realmId,
    minorVersion: config.minorVersion,
  });
}

main().catch((err) => {
  logger.error('Fatal:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
