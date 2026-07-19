import type { PaginationInfo } from '../qbo/client.js';

/**
 * Accounting basis reported in every envelope. Report tools echo the basis
 * QuickBooks actually used (from the report header) or the caller's request;
 * transactional/entity tools report NotApplicable because raw records are
 * not basis-dependent.
 */
export type AccountingBasis = 'Cash' | 'Accrual' | 'CompanyDefault' | 'NotApplicable';

export interface EnvelopeMeta {
  /** QuickBooks company ID (realm ID). */
  companyId: string;
  /** ISO date (YYYY-MM-DD). For point-in-time data this equals reportEndDate. */
  reportStartDate: string;
  reportEndDate: string;
  /** ISO 8601 timestamp of when this server retrieved the data. */
  retrievedAt: string;
  accountingBasis: AccountingBasis;
  /** ISO 4217 code of the report/home currency. */
  currency: string;
  environment: 'sandbox' | 'production';
}

export interface Envelope<T> {
  meta: EnvelopeMeta;
  data: T;
  pagination?: PaginationInfo;
  warnings?: string[];
}

export function buildEnvelope<T>(
  meta: Omit<EnvelopeMeta, 'retrievedAt'>,
  data: T,
  extras: { pagination?: PaginationInfo; warnings?: string[] } = {},
): Envelope<T> {
  return {
    meta: { ...meta, retrievedAt: new Date().toISOString() },
    data,
    ...(extras.pagination ? { pagination: extras.pagination } : {}),
    ...(extras.warnings && extras.warnings.length ? { warnings: extras.warnings } : {}),
  };
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface ReportHeader {
  StartPeriod?: string;
  EndPeriod?: string;
  ReportBasis?: string;
  Currency?: string;
}

/**
 * Pulls period/basis/currency out of a QBO report header, falling back to
 * what the caller requested and finally to sensible defaults.
 */
export function metaFromReport(
  report: Record<string, unknown>,
  fallback: {
    startDate?: string;
    endDate?: string;
    basis?: 'Cash' | 'Accrual';
    currency: string;
  },
): { reportStartDate: string; reportEndDate: string; accountingBasis: AccountingBasis; currency: string } {
  const header = (report.Header ?? {}) as ReportHeader;
  const basis: AccountingBasis =
    header.ReportBasis === 'Cash' || header.ReportBasis === 'Accrual'
      ? header.ReportBasis
      : (fallback.basis ?? 'CompanyDefault');
  return {
    reportStartDate: header.StartPeriod ?? fallback.startDate ?? todayIso(),
    reportEndDate: header.EndPeriod ?? fallback.endDate ?? todayIso(),
    accountingBasis: basis,
    currency: header.Currency ?? fallback.currency,
  };
}
