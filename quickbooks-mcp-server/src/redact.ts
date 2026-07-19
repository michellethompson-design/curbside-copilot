/**
 * Redaction + logging.
 *
 * Hard rules enforced here:
 *  - Nothing is ever written to stdout. stdout carries the MCP stdio
 *    transport; all diagnostics go to stderr.
 *  - Everything that reaches the logger passes through `redact()` /
 *    `redactText()` first, so access tokens, refresh tokens, client
 *    secrets, bank account numbers, tax IDs, and payroll identifiers
 *    never appear in logs even if a caller passes a raw object.
 *  - API response bodies are never logged at all (the QBO client only
 *    logs method, path, status, and timing) — redaction here is a
 *    second line of defense, not the only one.
 */

/** Object keys whose values must never be logged, matched case-insensitively. */
const SENSITIVE_KEY_RE =
  /^(access_token|refresh_token|id_token|token|authorization|client_secret|clientsecret|password|acctnum|accountnumber|acct_num|bankaccountnumber|bank_account_number|routingnumber|routing_number|taxidentifier|primarytaxidentifier|tax_identifier|ssn|social_security|ein|einnumber|payrollid|payroll_id|employeenumber|employee_number)$/i;

/** String patterns that look like credentials, redacted wherever they appear. */
const SENSITIVE_TEXT_PATTERNS: RegExp[] = [
  // JWT-shaped tokens (Intuit access tokens are JWTs)
  /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/g,
  // Bearer / Basic auth header values
  /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi,
  // key=value / "key": "value" forms for token-ish keys
  /\b(access_token|refresh_token|id_token|client_secret|password)["']?\s*[:=]\s*["']?[^"'&\s,}]+/gi,
  // Intuit refresh tokens (e.g. "AB11758…" / "RT1-…")
  /\bAB1[0-9A-Za-z]{20,}\b/g,
  /\bRT1-[0-9A-Za-z-]{16,}\b/g,
];

export const REDACTED = '[REDACTED]';

export function redactText(input: string): string {
  let out = input;
  for (const re of SENSITIVE_TEXT_PATTERNS) {
    out = out.replace(re, (match, keyGroup?: string) => {
      // For key[:=]value patterns keep the key name so logs stay debuggable.
      if (typeof keyGroup === 'string' && /token|secret|password/i.test(keyGroup)) {
        return `${keyGroup}=${REDACTED}`;
      }
      return REDACTED;
    });
  }
  return out;
}

/** Deep-redacts an arbitrary value: sensitive keys and token-shaped strings. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 12) return '[TRUNCATED]';
  if (typeof value === 'string') return redactText(value);
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Error) {
    return { name: value.name, message: redactText(value.message) };
  }
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEY_RE.test(k) ? REDACTED : redact(v, depth + 1);
  }
  return out;
}

function format(args: unknown[]): string {
  return args
    .map((a) => {
      if (typeof a === 'string') return redactText(a);
      try {
        return JSON.stringify(redact(a));
      } catch {
        return '[UNSERIALIZABLE]';
      }
    })
    .join(' ');
}

function write(level: 'info' | 'warn' | 'error', args: unknown[]): void {
  // stderr only — stdout is the MCP transport.
  process.stderr.write(
    `${new Date().toISOString()} [quickbooks-mcp] ${level.toUpperCase()} ${format(args)}\n`,
  );
}

export const logger = {
  info: (...args: unknown[]) => write('info', args),
  warn: (...args: unknown[]) => write('warn', args),
  error: (...args: unknown[]) => write('error', args),
};
