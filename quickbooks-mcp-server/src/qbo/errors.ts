/** Thrown whenever anything attempts a request that could mutate QuickBooks data. */
export class ReadOnlyViolationError extends Error {
  constructor(message: string) {
    super(`Read-only policy violation: ${message}`);
    this.name = 'ReadOnlyViolationError';
  }
}

export type QboErrorKind =
  | 'auth'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'rate_limit'
  | 'server'
  | 'network';

export interface QboFaultDetail {
  code?: string;
  message?: string;
  detail?: string;
  element?: string;
}

/**
 * Structured QuickBooks API error. `intuitTid` is Intuit's per-request trace
 * ID (safe to log and essential for Intuit support tickets). Messages are
 * built from the parsed Fault only — raw response bodies are never attached,
 * so an error can be logged without leaking report data.
 */
export class QboApiError extends Error {
  constructor(
    message: string,
    public readonly kind: QboErrorKind,
    public readonly status?: number,
    public readonly faults: QboFaultDetail[] = [],
    public readonly intuitTid?: string,
  ) {
    super(message);
    this.name = 'QboApiError';
  }
}

interface FaultBody {
  Fault?: {
    Error?: Array<{ Message?: string; Detail?: string; code?: string; element?: string }>;
    type?: string;
  };
  fault?: {
    error?: Array<{ message?: string; detail?: string; code?: string }>;
    type?: string;
  };
}

function kindForStatus(status: number): QboErrorKind {
  if (status === 401) return 'auth';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limit';
  if (status >= 500) return 'server';
  return 'validation';
}

/** Parses a QBO Fault body (both casings Intuit uses) into a QboApiError. */
export function errorFromResponse(status: number, body: unknown, intuitTid?: string): QboApiError {
  const kind = kindForStatus(status);
  const faults: QboFaultDetail[] = [];
  const fb = body as FaultBody;
  const rawErrors = fb?.Fault?.Error ?? fb?.fault?.error ?? [];
  for (const e of rawErrors) {
    const anyE = e as Record<string, string | undefined>;
    faults.push({
      code: anyE.code,
      message: anyE.Message ?? anyE.message,
      detail: anyE.Detail ?? anyE.detail,
      element: (anyE.element as string | undefined) ?? undefined,
    });
  }
  const summary =
    faults
      .map((f) => [f.code && `[${f.code}]`, f.message, f.detail].filter(Boolean).join(' '))
      .join('; ') || `QuickBooks API request failed with HTTP ${status}`;
  return new QboApiError(summary, kind, status, faults, intuitTid);
}

/** User-facing description safe to return in a tool error result. */
export function describeError(err: unknown): string {
  if (err instanceof ReadOnlyViolationError) return err.message;
  if (err instanceof QboApiError) {
    const tid = err.intuitTid ? ` (intuit_tid: ${err.intuitTid})` : '';
    switch (err.kind) {
      case 'auth':
        return `QuickBooks authentication failed: ${err.message}${tid}`;
      case 'rate_limit':
        return `QuickBooks API rate limit hit (HTTP 429). Retry later.${tid}`;
      case 'server':
        return `QuickBooks API server error (HTTP ${err.status}): ${err.message}${tid}`;
      default:
        return `QuickBooks API error (HTTP ${err.status ?? '?'}): ${err.message}${tid}`;
    }
  }
  if (err instanceof Error) return err.message;
  return String(err);
}
