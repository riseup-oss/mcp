import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { loadConfigFromEnv, riseupGet, type RiseupClientConfig } from '../client.js';

const CASHFLOW_MONTH = z.string().regex(/^\d{4}-\d{2}$/, {
  message: 'Use "YYYY-MM" (e.g. "2026-05"). Compute the current month from today\'s date if the user asked about "this month".',
});
const TRANSACTION_DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
  message: 'Use "YYYY-MM-DD" (e.g. "2026-06-15")',
});

export type TransactionsFilters = {
  cashflowMonth?: string,
  transactionDate?: string,
  businessName?: string,
};

export async function fetchTransactions(filters: TransactionsFilters, config: RiseupClientConfig): Promise<unknown> {
  const query = new URLSearchParams();
  if (filters.cashflowMonth) query.set('cashflowMonth', filters.cashflowMonth);
  if (filters.transactionDate) query.set('transactionDate', filters.transactionDate);
  if (filters.businessName) query.set('businessName', filters.businessName);
  const qs = query.toString();
  return riseupGet(config, `/api/external/transactions${qs ? `?${qs}` : ''}`);
}

export function registerTransactionsTool(server: McpServer): void {
  server.registerTool(
    'get_transactions',
    {
      description: `Get individual transactions from the customer's RiseUp cashflow, filtered by month, exact date, or merchant name. Use this when the user asks about specific transactions, purchases, or spending at particular merchants — as opposed to overall budget categories which live in \`get_budget\`.

Filters combine with AND. At least one of \`cashflowMonth\` or \`transactionDate\` is required — unfiltered queries are rejected server-side to avoid unbounded results.

Input parameters:
  - cashflowMonth (string, optional): The cashflow month in "YYYY-MM" format (e.g. "2026-06").
                                       Compute the current month from today's date if the user asks
                                       about "this month" — the API does not accept "current" or "previous".
  - transactionDate (string, optional): An exact transaction date in "YYYY-MM-DD" format
                                        (e.g. "2026-06-15"). Matches transactions whose transactionDate equals this value.
  - businessName (string, optional): A substring of the merchant name. Matched case-insensitively
                                     as a substring — passing "restaurant" matches "Some Restaurant Chain".
                                     Max 100 chars, no HTML/code chars (<>{}[]\\/"').

Response shape:
{
  transactions: [
    {
      transactionId: string,
      transactionDate: ISO datetime,         // when the transaction occurred, e.g. "2026-06-15T00:00:00.000Z" — always UTC midnight; the date part is the transaction day
      billingDate: ISO datetime,             // when it was billed (differs from transactionDate for credit cards); absent on some transactions
      cashflowDate: "YYYY-MM",               // the cashflow month this transaction is allocated to
      businessName: string,                  // merchant name
      isIncome: boolean,                     // true = income, false = expense
      amount: number,                        // money value in ILS (absolute); use isIncome to determine direction
      accountNickname: string | null,        // customer-defined label for the source account, set in the RiseUp app; null if the customer hasn't set one
      isInstallment: boolean,                // true if part of a payment plan
      installmentNumber: number,             // current installment index (only meaningful when isInstallment)
      totalNumberOfInstallments: number,     // total planned installments (only meaningful when isInstallment)
      totalNumberOfPayments: number,         // legacy alias for totalNumberOfInstallments; may also appear
      isPostponed: boolean,                  // true if pushed to the next month's cashflow (credit-card postponement)
      sourceType: string,                    // account type enum, e.g. "creditCard", "checkingAccount"
      source: string,                        // specific source name/identifier (bank / credit-card provider)
      commitmentId: string | null,           // populated when the transaction is part of a recurring/fixed commitment (rent, subscription, etc.); null for variable/one-off expenses. Same signal as actualType === "fixed".
      actualType: "fixed" | "variable",      // whether the transaction is a recurring fixed expense/income or a variable/one-off. May be absent for older transactions.
      categoryLabel: string,                 // customer-facing category name (Hebrew string, e.g. "מסעדות", "ביגוד"). Can be "אחר" (other) when unclassified.
      categoryType: "default" | "custom" | "other",  // "default": one of RiseUp's built-in system categories. "custom": a category the customer created themselves. "other": the transaction didn't fit any known category (unclassified). May be absent for older transactions.
    },
    ...
  ],
  _meta: { source: "riseup-external-api", tokenRef: string }
}

All money values are in Israeli shekels (ILS) and stored as positive numbers — use \`isIncome\` to determine income vs expense, don't infer from sign. Installment fields (\`installmentNumber\`, \`totalNumberOfInstallments\`, \`totalNumberOfPayments\`) are only meaningful when \`isInstallment\` is true. Fields that aren't populated for a given transaction may be absent.`,
      inputSchema: {
        cashflowMonth: CASHFLOW_MONTH.optional().describe(
          'The cashflow month in "YYYY-MM" format (e.g. "2026-06"). Required unless transactionDate is provided. Does not accept "current" or "previous" — compute the actual month from today\'s date.',
        ),
        transactionDate: TRANSACTION_DATE.optional().describe(
          'An exact transaction date in "YYYY-MM-DD" format. Filters transactions whose transactionDate equals this value.',
        ),
        businessName: z.string().optional().describe(
          'A substring of the merchant name, matched case-insensitively. Max 100 chars.',
        ),
      },
    },
    async ({ cashflowMonth, transactionDate, businessName }) => {
      if (!cashflowMonth && !transactionDate) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: 'Provide cashflowMonth ("YYYY-MM") or transactionDate ("YYYY-MM-DD") — businessName alone is not enough. Compute the month from today\'s date if the user asked about "this month".',
            },
          ],
        };
      }
      const result = await fetchTransactions(
        { cashflowMonth, transactionDate, businessName },
        loadConfigFromEnv(),
      );
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );
}
