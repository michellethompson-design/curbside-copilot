import { z } from 'zod';

/**
 * All credentials come from the environment (or the encrypted token store —
 * see auth/tokenStore.ts). Nothing is ever read from command-line arguments,
 * which can leak via process listings.
 */
const configSchema = z.object({
  clientId: z.string().min(1, 'QB_CLIENT_ID is required'),
  clientSecret: z.string().min(1, 'QB_CLIENT_SECRET is required'),
  realmId: z.string().min(1, 'QB_REALM_ID (QuickBooks company ID) is required'),
  environment: z.enum(['sandbox', 'production']),
  /** Seed refresh token. Optional when the encrypted token store already holds one. */
  refreshToken: z.string().optional(),
  /** Path to the encrypted token store file (AES-256-GCM). Optional. */
  tokenStorePath: z.string().optional(),
  /** 32-byte key (64 hex chars or base64) for the token store. Required with tokenStorePath. */
  tokenEncryptionKey: z.string().optional(),
  minorVersion: z.string().regex(/^\d+$/),
  /** Safety cap on pagination fan-out per query tool call. */
  maxQueryPages: z.number().int().min(1).max(100),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = configSchema.safeParse({
    clientId: env.QB_CLIENT_ID ?? '',
    clientSecret: env.QB_CLIENT_SECRET ?? '',
    realmId: env.QB_REALM_ID ?? '',
    environment: env.QB_ENVIRONMENT ?? 'sandbox',
    refreshToken: env.QB_REFRESH_TOKEN || undefined,
    tokenStorePath: env.QB_TOKEN_STORE_PATH || undefined,
    tokenEncryptionKey: env.QB_TOKEN_ENCRYPTION_KEY || undefined,
    minorVersion: env.QB_MINOR_VERSION ?? '75',
    maxQueryPages: env.QB_MAX_QUERY_PAGES ? Number(env.QB_MAX_QUERY_PAGES) : 10,
  });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => i.message).join('; ');
    throw new Error(`Invalid configuration: ${issues}`);
  }
  const config = parsed.data;
  if (config.tokenStorePath && !config.tokenEncryptionKey) {
    throw new Error(
      'QB_TOKEN_ENCRYPTION_KEY is required when QB_TOKEN_STORE_PATH is set (the token store is always encrypted).',
    );
  }
  if (!config.refreshToken && !config.tokenStorePath) {
    throw new Error(
      'No credentials source: set QB_REFRESH_TOKEN, or configure QB_TOKEN_STORE_PATH + QB_TOKEN_ENCRYPTION_KEY (run `npm run auth` to populate it).',
    );
  }
  return config;
}
