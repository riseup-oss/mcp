import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { loadConfigFromEnv, riseupGet, type RiseupClientConfig } from '../client.js';

const BUDGET_DATE = z.string().regex(/^(\d{4}-\d{2}|current|previous)$/, {
  message: 'Use "YYYY-MM" (e.g. "2026-05"), "current", or "previous"',
});

export async function fetchBudget(date: string, config: RiseupClientConfig): Promise<unknown> {
  return riseupGet(config, `/api/external/budget/${encodeURIComponent(date)}`);
}

export function registerBudgetTool(server: McpServer): void {
  server.registerTool(
    'get_budget',
    {
      description: `Get the customer's RiseUp budget for a given month. The budget groups transactions into envelopes (categories) and shows planned vs. actual amount for each. Use this when the user asks about their budget as a whole, categories, envelopes, planned vs. actual spending, or overspending; use \`get_transactions\` instead when they ask about individual transactions or merchants.

Input parameters:
  - date (string, required): The month to fetch. One of:
      - "YYYY-MM" — a specific month (e.g. "2026-05")
      - "current" — the current cashflow month
      - "previous" — the previous cashflow month

Response shape:
{
  budgetDate: "YYYY-MM",                     // the month this response covers
  lastUpdatedAt: ISO datetime,                // when the cashflow was last refreshed
  envelopes: [
    {
      id: string,
      type: "fixed" | "variable" | "variableIncome" | "trackingCategory" | "riseupGoal",
      balancedAmount: number,                 // planned/budgeted amount for this envelope (ILS, negative for expenses)
      originalAmount: number,                 // original budgeted amount before any customer adjustment
      balanceDate: string,                    // when this envelope was last balanced
      isCustomPrediction: boolean,            // true if customer overrode the prediction
      sequenceCustomerComment: string,        // customer's own note about this envelope
      actuals: [
        {
          transactionId: string,
          transactionDate: "YYYY-MM-DD",       // when the transaction happened
          billingDate: "YYYY-MM-DD",           // when it was billed
          businessName: string,                // merchant name
          isIncome: boolean,                   // true = income, false = expense
          billingAmount: number | null,        // ILS amount for EXPENSES; null when isIncome is true
          incomeAmount: number | null,         // ILS amount for INCOMES; null when isIncome is false
                                               // exactly one of billingAmount / incomeAmount is non-null per transaction
          originalAmount: number,              // amount in original currency / before conversions
          accountNickname: string | null,      // customer-defined label for the source account, set in the RiseUp app; null if the customer hasn't set one
          accountNumberHash: string | null,    // stable 6-character opaque identifier for the source account. Use to distinguish actuals across multiple accounts under the same \`source\` (e.g. two different Isracard cards on the same customer). Same account → same hash across every response. Not a cryptographic hash and not the raw account number. Null when no matching identifier is available.
          isInstallment: boolean,              // true when part of a payment plan
          paymentNumber: number,               // 1..totalNumberOfPayments (installments only)
          totalNumberOfPayments: number,       // total installments (installments only)
          expense: string,                     // system-computed fallback category label (Hebrew), e.g. "ביגוד", "מסעדות"; used when no specific category is set
          // ... plus sequenceId, placement, transactionBudgetDate, isPostponed,
          //     sourceType, source, monthsInterval when applicable
        }
      ]
    }
  ],
  excluded: [...],                            // transactions the customer marked as one-offs
  _meta: { source: "riseup-external-api", tokenRef: string }
}

Envelope type semantics:
  - 'fixed': Fixed customer expenses (rent, subscriptions, insurance) — recurring with known amounts.
  - 'trackingCategory': A category the customer has chosen to track with a spending goal (e.g. "restaurants" with an 800 ILS/month target). \`balancedAmount\` here represents the goal.
  - 'variable': "Other" day-to-day discretionary spending — not fixed and not in a tracked category. When users ask about "variable expenses" they mean this bucket.
  - 'variableIncome': Variable (non-fixed) income — freelance, one-off payments, etc. There is no tracked-category concept for incomes.
  - 'riseupGoal': A savings goal the customer set through the RiseUp product.

\`excluded\` contains transactions the customer marked as one-offs to exclude from the monthly cashflow — atypical spending they don't want counted as regular. Same shape as the transactions inside envelope actuals.

All money fields are in Israeli shekels (ILS). On each actual, \`billingAmount\` is populated for expenses and \`incomeAmount\` for incomes — **exactly one is non-null per transaction** (use \`isIncome\` to pick which). Envelope-level \`balancedAmount\` uses a signed convention: negative for expense categories, positive for income categories.`,
      inputSchema: {
        date: BUDGET_DATE.describe(
          'The month to fetch. Accepts "YYYY-MM" (e.g. "2026-05"), "current" (the current cashflow month), or "previous" (the previous cashflow month).',
        ),
      },
    },
    async ({ date }) => {
      const budget = await fetchBudget(date, loadConfigFromEnv());
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(budget, null, 2),
          },
        ],
      };
    },
  );
}
