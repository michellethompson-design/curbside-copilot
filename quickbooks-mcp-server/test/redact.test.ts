import { describe, expect, it } from 'vitest';
import { REDACTED, redact, redactText } from '../src/redact.js';

describe('redactText', () => {
  it('redacts JWT-shaped access tokens', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0In0.SflKxwRJSMeKKF2QT4fwpM';
    expect(redactText(`token is ${jwt} ok`)).not.toContain(jwt);
  });

  it('redacts Bearer and Basic authorization header values', () => {
    expect(redactText('Authorization: Bearer abcDEF123456789xyz')).not.toContain('abcDEF123456789xyz');
    expect(redactText('Authorization: Basic dXNlcjpwYXNzd29yZA==')).not.toContain('dXNlcjpwYXNzd29yZA');
  });

  it('redacts token key=value pairs while keeping key names', () => {
    const out = redactText('refresh_token=AB117abcdefghijklmnopqrstuvwx&x=1');
    expect(out).toContain('refresh_token=');
    expect(out).not.toContain('AB117abcdefghijklmnopqrstuvwx');
  });

  it('redacts Intuit-style refresh token strings anywhere', () => {
    const rt = 'AB11758129301abcdefghijklmnop';
    expect(redactText(`oops ${rt}`)).not.toContain(rt);
  });
});

describe('redact (deep object redaction)', () => {
  it('redacts sensitive keys case-insensitively', () => {
    const input = {
      access_token: 'secret-a',
      Refresh_Token: 'secret-b',
      AcctNum: '9876543210',
      TaxIdentifier: '12-3456789',
      SSN: '078-05-1120',
      RoutingNumber: '021000021',
      safe: 'keep-me',
    };
    const out = redact(input) as Record<string, unknown>;
    expect(out.access_token).toBe(REDACTED);
    expect(out.Refresh_Token).toBe(REDACTED);
    expect(out.AcctNum).toBe(REDACTED);
    expect(out.TaxIdentifier).toBe(REDACTED);
    expect(out.SSN).toBe(REDACTED);
    expect(out.RoutingNumber).toBe(REDACTED);
    expect(out.safe).toBe('keep-me');
  });

  it('redacts nested objects and arrays', () => {
    const out = redact({ a: [{ authorization: 'Bearer zz' }], b: { c: { client_secret: 'x' } } }) as {
      a: Array<Record<string, unknown>>;
      b: { c: Record<string, unknown> };
    };
    expect(out.a[0]?.authorization).toBe(REDACTED);
    expect(out.b.c.client_secret).toBe(REDACTED);
  });

  it('redacts payroll-adjacent identifiers', () => {
    const out = redact({ EmployeeNumber: 'E-100', PayrollId: 'P-1' }) as Record<string, unknown>;
    expect(out.EmployeeNumber).toBe(REDACTED);
    expect(out.PayrollId).toBe(REDACTED);
  });

  it('sanitizes Error objects to name + redacted message', () => {
    const err = new Error('failed with Bearer supersecrettoken1234');
    const out = redact(err) as { name: string; message: string };
    expect(out.name).toBe('Error');
    expect(out.message).not.toContain('supersecrettoken1234');
  });
});
