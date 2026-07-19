import type { McpServer, ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z, type ZodRawShape } from 'zod';
import type { QboClient } from '../qbo/client.js';
import { describeError } from '../qbo/errors.js';
import { logger } from '../redact.js';
import { buildEnvelope, metaFromReport, todayIso, type AccountingBasis } from './envelope.js';

export interface ToolContext {
  client: QboClient;
  realmId: string;
  environment: 'sandbox' | 'production';
}

/** All tools are strictly read-only; annotations advertise that to clients. */
const READ_ONLY_ANNOTATIONS = Object.freeze({
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
});

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be an ISO date (YYYY-MM-DD)')
  .describe('ISO date, YYYY-MM-DD');
const basisSchema = z
  .enum(['Cash', 'Accrual'])
  .describe('Accounting basis for the report. Omit to use the company default.');

function jsonResult(payload: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }] };
}

function errorResult(err: unknown) {
  // describeError never includes raw response bodies or token material.
  const message = describeError(err);
  logger.error('Tool call failed:', message);
  return { isError: true, content: [{ type: 'text' as const, text: message }] };
}

/**
 * Masks anything that could be a bank/credit-card account number in chart
 * of accounts data. GL codes on ordinary accounts are left alone; for Bank
 * and Credit Card accounts, AcctNum may hold the real bank account number,
 * so only the last 4 characters are returned.
 */
export function maskSensitiveAccountFields(
  account: Record<string, unknown>,
): Record<string, unknown> {
  const type = account.AccountType;
  const acctNum = account.AcctNum;
  if (
    typeof acctNum === 'string' &&
    acctNum.length > 0 &&
    (type === 'Bank' || type === 'Credit Card')
  ) {
    const last4 = acctNum.slice(-4);
    return { ...account, AcctNum: `****${last4}` };
  }
  return account;
}

/** Home currency, fetched once per process from CompanyInfo. */
function makeCurrencyResolver(ctx: ToolContext): () => Promise<string> {
  let cached: string | null = null;
  return async () => {
    if (cached) return cached;
    try {
      const info = await ctx.client.getCompanyInfo();
      const ref = info.CurrencyRef as { value?: string } | undefined;
      cached = ref?.value ?? 'USD';
    } catch {
      // Currency lookup is best-effort metadata; don't fail the actual tool call.
      cached = 'USD';
    }
    return cached;
  };
}

export function registerTools(server: McpServer, ctx: ToolContext): void {
  const homeCurrency = makeCurrencyResolver(ctx);

  const register = <S extends ZodRawShape>(
    name: string,
    title: string,
    description: string,
    inputSchema: S,
    handler: (args: z.objectOutputType<S, z.ZodTypeAny>) => Promise<unknown>,
  ) => {
    const cb = (async (args: z.objectOutputType<S, z.ZodTypeAny>) => {
      try {
        return jsonResult(await handler(args));
      } catch (err) {
        return errorResult(err);
      }
    }) as unknown as ToolCallback<S>;
    server.registerTool(
      name,
      {
        title,
        description: `${description} Read-only: this server never creates, updates, or deletes QuickBooks data.`,
        inputSchema,
        annotations: { title, ...READ_ONLY_ANNOTATIONS },
      },
      cb,
    );
  };

  const baseMeta = { companyId: ctx.realmId, environment: ctx.environment };

  // A generic report-tool helper: request the report, derive meta from its header.
  const reportEnvelope = async (
    report: Awaited<ReturnType<QboClient['getReport']>>,
    fallback: { startDate?: string; endDate?: string; basis?: 'Cash' | 'Accrual' },
    pagination?: undefined,
    warnings?: string[],
  ) => {
    const meta = metaFromReport(report, { ...fallback, currency: await homeCurrency() });
    return buildEnvelope({ ...baseMeta, ...meta }, report, { pagination, warnings });
  };

  register(
    'qb_company_info',
    'Company information',
    'Fetches QuickBooks company profile: legal name, address, fiscal year start, home currency.',
    {},
    async () => {
      const info = await ctx.client.getCompanyInfo();
      const today = todayIso();
      return buildEnvelope(
        {
          ...baseMeta,
          reportStartDate: today,
          reportEndDate: today,
          accountingBasis: 'NotApplicable' as AccountingBasis,
          currency: await homeCurrency(),
        },
        info,
      );
    },
  );

  register(
    'qb_chart_of_accounts',
    'Chart of accounts',
    'Lists all accounts (name, type, classification, current balance). Bank and credit-card account numbers are masked to the last 4 digits.',
    { activeOnly: z.boolean().optional().describe('Only return active accounts (default: all).') },
    async ({ activeOnly }) => {
      const result = await ctx.client.queryAll(
        'Account',
        activeOnly ? 'Active = true' : undefined,
        'Id',
      );
      const today = todayIso();
      return buildEnvelope(
        {
          ...baseMeta,
          reportStartDate: today,
          reportEndDate: today,
          accountingBasis: 'NotApplicable' as AccountingBasis,
          currency: await homeCurrency(),
        },
        result.items.map(maskSensitiveAccountFields),
        { pagination: result.pagination },
      );
    },
  );

  register(
    'qb_balance_sheet',
    'Balance sheet',
    'Balance Sheet report. Defaults to the current fiscal year to date when no dates are given.',
    {
      startDate: isoDate.optional(),
      endDate: isoDate.optional().describe('“As of” date for the balance sheet (YYYY-MM-DD).'),
      accountingBasis: basisSchema.optional(),
    },
    async ({ startDate, endDate, accountingBasis }) => {
      const report = await ctx.client.getReport('BalanceSheet', {
        start_date: startDate,
        end_date: endDate,
        accounting_method: accountingBasis,
      });
      return reportEnvelope(report, { startDate, endDate, basis: accountingBasis });
    },
  );

  register(
    'qb_profit_and_loss_by_month',
    'Profit & loss by month',
    'Profit and Loss report broken out into monthly columns over the given date range.',
    {
      startDate: isoDate,
      endDate: isoDate,
      accountingBasis: basisSchema.optional(),
    },
    async ({ startDate, endDate, accountingBasis }) => {
      const report = await ctx.client.getReport('ProfitAndLoss', {
        start_date: startDate,
        end_date: endDate,
        accounting_method: accountingBasis,
        summarize_column_by: 'Month',
      });
      return reportEnvelope(report, { startDate, endDate, basis: accountingBasis });
    },
  );

  register(
    'qb_cash_flow',
    'Statement of cash flows',
    'Statement of Cash Flows report for the given date range.',
    {
      startDate: isoDate.optional(),
      endDate: isoDate.optional(),
      accountingBasis: basisSchema.optional(),
    },
    async ({ startDate, endDate, accountingBasis }) => {
      const report = await ctx.client.getReport('CashFlow', {
        start_date: startDate,
        end_date: endDate,
        accounting_method: accountingBasis,
      });
      return reportEnvelope(report, { startDate, endDate, basis: accountingBasis });
    },
  );

  register(
    'qb_general_ledger',
    'General ledger',
    'General Ledger report: every posted transaction line by account for the date range. Optionally filtered to specific account IDs.',
    {
      startDate: isoDate.optional(),
      endDate: isoDate.optional(),
      accountingBasis: basisSchema.optional(),
      accountIds: z
        .array(z.string())
        .optional()
        .describe('QuickBooks Account IDs to restrict the ledger to.'),
    },
    async ({ startDate, endDate, accountingBasis, accountIds }) => {
      const report = await ctx.client.getReport('GeneralLedger', {
        start_date: startDate,
        end_date: endDate,
        accounting_method: accountingBasis,
        account: accountIds?.length ? accountIds.join(',') : undefined,
        columns: 'tx_date,txn_type,doc_num,name,memo,split_acc,subt_nat_amount,rbal_nat_amount',
      });
      return reportEnvelope(report, { startDate, endDate, basis: accountingBasis });
    },
  );

  register(
    'qb_transaction_detail',
    'Transaction detail',
    'Transaction List report: individual transactions (date, type, number, name, memo, account, amount) for the date range, optionally filtered by transaction type.',
    {
      startDate: isoDate.optional(),
      endDate: isoDate.optional(),
      accountingBasis: basisSchema.optional(),
      transactionType: z
        .string()
        .optional()
        .describe('QuickBooks transaction type filter, e.g. "Invoice", "Bill", "Payment".'),
    },
    async ({ startDate, endDate, accountingBasis, transactionType }) => {
      const report = await ctx.client.getReport('TransactionList', {
        start_date: startDate,
        end_date: endDate,
        accounting_method: accountingBasis,
        transaction_type: transactionType,
      });
      return reportEnvelope(report, { startDate, endDate, basis: accountingBasis });
    },
  );

  register(
    'qb_ar_aging',
    'Accounts receivable aging',
    'Accounts Receivable aging report (summary by default, or per-invoice detail).',
    {
      asOfDate: isoDate.optional().describe('Aging “as of” date (default: today).'),
      detail: z.boolean().optional().describe('true for per-invoice detail, false/omitted for summary.'),
    },
    async ({ asOfDate, detail }) => {
      const report = await ctx.client.getReport(detail ? 'AgedReceivableDetail' : 'AgedReceivables', {
        report_date: asOfDate,
      });
      return reportEnvelope(report, { startDate: asOfDate, endDate: asOfDate });
    },
  );

  register(
    'qb_ap_aging',
    'Accounts payable aging',
    'Accounts Payable aging report (summary by default, or per-bill detail).',
    {
      asOfDate: isoDate.optional().describe('Aging “as of” date (default: today).'),
      detail: z.boolean().optional().describe('true for per-bill detail, false/omitted for summary.'),
    },
    async ({ asOfDate, detail }) => {
      const report = await ctx.client.getReport(detail ? 'AgedPayableDetail' : 'AgedPayables', {
        report_date: asOfDate,
      });
      return reportEnvelope(report, { startDate: asOfDate, endDate: asOfDate });
    },
  );

  register(
    'qb_open_invoices',
    'Open invoices',
    'All invoices with an outstanding balance (paginated entity query).',
    {},
    async () => {
      const result = await ctx.client.queryAll('Invoice', "Balance > '0'", 'DueDate');
      const today = todayIso();
      return buildEnvelope(
        {
          ...baseMeta,
          reportStartDate: today,
          reportEndDate: today,
          accountingBasis: 'NotApplicable' as AccountingBasis,
          currency: await homeCurrency(),
        },
        result.items,
        { pagination: result.pagination },
      );
    },
  );

  register(
    'qb_open_bills',
    'Open bills',
    'All vendor bills with an outstanding balance (paginated entity query).',
    {},
    async () => {
      const result = await ctx.client.queryAll('Bill', "Balance > '0'", 'DueDate');
      const today = todayIso();
      return buildEnvelope(
        {
          ...baseMeta,
          reportStartDate: today,
          reportEndDate: today,
          accountingBasis: 'NotApplicable' as AccountingBasis,
          currency: await homeCurrency(),
        },
        result.items,
        { pagination: result.pagination },
      );
    },
  );
}
