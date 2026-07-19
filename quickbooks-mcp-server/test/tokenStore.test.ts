import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EncryptedFileTokenStore, InMemoryTokenStore, type TokenSet } from '../src/auth/tokenStore.js';

const tokens: TokenSet = {
  accessToken: 'access-abc',
  refreshToken: 'refresh-xyz',
  accessTokenExpiresAt: 1_900_000_000_000,
  refreshTokenExpiresAt: 1_910_000_000_000,
};

describe('InMemoryTokenStore', () => {
  it('round-trips tokens and starts empty', () => {
    const store = new InMemoryTokenStore();
    expect(store.load()).toBeNull();
    store.save(tokens);
    expect(store.load()).toEqual(tokens);
  });
});

describe('EncryptedFileTokenStore', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'qb-token-store-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const key = Buffer.alloc(32, 7);

  it('round-trips tokens through an encrypted file', () => {
    const path = join(dir, 'tokens.enc');
    const store = new EncryptedFileTokenStore(path, key);
    expect(store.load()).toBeNull();
    store.save(tokens);
    expect(store.load()).toEqual(tokens);
  });

  it('never writes token material to disk in plaintext', () => {
    const path = join(dir, 'tokens.enc');
    new EncryptedFileTokenStore(path, key).save(tokens);
    const raw = readFileSync(path, 'utf8');
    expect(raw).not.toContain('access-abc');
    expect(raw).not.toContain('refresh-xyz');
  });

  it('fails to decrypt with the wrong key', () => {
    const path = join(dir, 'tokens.enc');
    new EncryptedFileTokenStore(path, key).save(tokens);
    const wrong = new EncryptedFileTokenStore(path, Buffer.alloc(32, 9));
    expect(() => wrong.load()).toThrow(/decrypt|wrong/i);
  });

  it('rejects keys that are not 32 bytes', () => {
    expect(() => new EncryptedFileTokenStore(join(dir, 'x'), Buffer.alloc(16))).toThrow(/32 bytes/);
    expect(() => EncryptedFileTokenStore.keyFromString('too-short')).toThrow(/32-byte/);
  });

  it('accepts 64-char hex and base64 32-byte keys', () => {
    expect(EncryptedFileTokenStore.keyFromString('ab'.repeat(32))).toHaveLength(32);
    expect(EncryptedFileTokenStore.keyFromString(Buffer.alloc(32, 1).toString('base64'))).toHaveLength(32);
  });
});
