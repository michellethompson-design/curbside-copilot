import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  /** Unix ms after which the access token is no longer valid. */
  accessTokenExpiresAt: number;
  /** Unix ms after which the refresh token is no longer valid (Intuit: ~100 days). */
  refreshTokenExpiresAt?: number;
}

export interface TokenStore {
  load(): TokenSet | null;
  save(tokens: TokenSet): void;
  /** Human-readable description for diagnostics (never includes secrets). */
  describe(): string;
}

/**
 * Holds rotated tokens for the lifetime of the process only. Used when no
 * encrypted store is configured; the seed refresh token stays in the
 * environment and rotated successors live in memory.
 */
export class InMemoryTokenStore implements TokenStore {
  private tokens: TokenSet | null = null;
  load(): TokenSet | null {
    return this.tokens;
  }
  save(tokens: TokenSet): void {
    this.tokens = tokens;
  }
  describe(): string {
    return 'in-memory (rotated refresh tokens are lost on process exit)';
  }
}

interface EncryptedFilePayload {
  v: 1;
  alg: 'aes-256-gcm';
  iv: string;
  tag: string;
  data: string;
}

/**
 * AES-256-GCM encrypted file store. Intuit rotates the refresh token on
 * every refresh, so the newest token must be persisted somewhere durable —
 * this store keeps it encrypted at rest with a key that itself lives only
 * in the environment.
 */
export class EncryptedFileTokenStore implements TokenStore {
  constructor(
    private readonly filePath: string,
    private readonly key: Buffer,
  ) {
    if (key.length !== 32) {
      throw new Error('Token store encryption key must be exactly 32 bytes.');
    }
  }

  /** Accepts a 64-char hex string or base64 for a 32-byte key. */
  static keyFromString(raw: string): Buffer {
    if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
    const b64 = Buffer.from(raw, 'base64');
    if (b64.length === 32) return b64;
    throw new Error(
      'QB_TOKEN_ENCRYPTION_KEY must be a 32-byte key encoded as 64 hex characters or base64 (generate one with: openssl rand -hex 32).',
    );
  }

  load(): TokenSet | null {
    if (!existsSync(this.filePath)) return null;
    let payload: EncryptedFilePayload;
    try {
      payload = JSON.parse(readFileSync(this.filePath, 'utf8')) as EncryptedFilePayload;
    } catch {
      throw new Error(`Token store at ${this.filePath} is not valid JSON; delete it and re-run auth.`);
    }
    if (payload.v !== 1 || payload.alg !== 'aes-256-gcm') {
      throw new Error(`Token store at ${this.filePath} has an unsupported format.`);
    }
    try {
      const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(payload.iv, 'base64'));
      decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
      const plain = Buffer.concat([
        decipher.update(Buffer.from(payload.data, 'base64')),
        decipher.final(),
      ]);
      return JSON.parse(plain.toString('utf8')) as TokenSet;
    } catch {
      throw new Error(
        `Failed to decrypt token store at ${this.filePath} — wrong QB_TOKEN_ENCRYPTION_KEY or corrupted file.`,
      );
    }
  }

  save(tokens: TokenSet): void {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([cipher.update(JSON.stringify(tokens), 'utf8'), cipher.final()]);
    const payload: EncryptedFilePayload = {
      v: 1,
      alg: 'aes-256-gcm',
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      data: data.toString('base64'),
    };
    mkdirSync(dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    writeFileSync(tmp, JSON.stringify(payload), { mode: 0o600 });
    renameSync(tmp, this.filePath);
  }

  describe(): string {
    return `encrypted file (aes-256-gcm) at ${this.filePath}`;
  }
}
