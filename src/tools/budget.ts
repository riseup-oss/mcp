import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { loadConfigFromEnv, riseupGet, type RiseupClientConfig } from '../client.js';
import { jsonToolResult } from './tool-result.js';

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
      description: `Get the customer's RiseUp budget for a given month. The budget groups transactions into envelopes (categories) and shows the target vs. actual amount for each. Use this when the user asks about their budget as a whole, categories, envelopes, targets vs. actual spending, or overspending; use \`get_transactions\` instead when they ask about individual transactions or merchants.

Input parameters:
  - date (string, required): The month to fetch. One of:
      - "YYYY-MM" — a specific month (e.g. "2026-05")
      - "current" — the current cashflow month
      - "previous" — the previous cashflow month

Response shape:
{
  budgetDate: "YYYY-MM",                     // the cashflow month this response covers
  lastUpdatedAt: ISO datetime,                // when the cashflow was last refreshed
  envelopes: [
    {
      id: string,
      type: "fixed" | "variable" | "variableIncome" | "trackingCategory" | "riseupGoal",
      originalAmount: number | null,          // the envelope's planned amount for the month (ILS); it stays as planned after transactions arrive. On 'trackingCategory': the category's target ("יעד בקטגוריה"); a target of 0 set by the customer means no budget. On 'fixed': the predicted amount of this fixed expense or income. On 'riseupGoal': the goal amount. null on 'variable' and 'variableIncome', which have no plan (null means "no plan", not a target of 0).
      isCustomPrediction?: boolean,           // 'trackingCategory' only: who set the target in originalAmount — true = the customer set it, false = RiseUp estimated it from the customer's history
      balancedAmount: number | null,          // deprecated, kept for compatibility: use originalAmount for the plan and the actuals for what actually happened (see 'fixed' below). It is not updated from transactions (it equals originalAmount on 'fixed' and is 0 on 'trackingCategory'), so don't read it as a target or as an amount spent
      balanceDate: string,                    // when RiseUp stops waiting for transactions in this envelope. On 'fixed': the date by which the payment is expected; if it has no actuals and this date is before lastUpdatedAt, it did not arrive this month. On 'trackingCategory': shortly after its week or month ends, when the period closes; not needed to judge over or under the target
      sequenceCustomerComment: string,        // customer's own note about this envelope
      details?: {                             // 'trackingCategory' only
        trackingCategory: {
          name: string,                       // the category name. Two stored names differ from what the customer sees in the app: "כלכלה" is shown as "סופר", and "__saving-hidden-category__" is shown as "השקעה וחיסכון" (savings). Any other name is the name the customer sees (it may be one they created)
          trackingCategoryType: string,       // "saving" for the savings category (money put aside, not spending); otherwise e.g. "custom"
          frequency: "monthly" | "weekly"     // "weekly" (usually "סופר"): the category comes as one envelope per week, all with the same name
        },
        startDate: "YYYY-MM-DD",              // weekly only: first day of this week's envelope
        endDate: "YYYY-MM-DD",                // weekly only: the day AFTER this week's last day (exclusive)
        weeklyIndex: number                   // weekly only: 0-based week number within the month
      },
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
          originalAmount: number | null,       // NOT the envelope's originalAmount. The purchase amount in its original currency, before conversion to ILS (e.g. USD for a purchase abroad); for an installment, the full purchase amount; null on bank-account transactions. Use billingAmount / incomeAmount for the ILS amount
          accountNickname: string | null,      // customer-defined label for the source account, set in the RiseUp app; null if the customer hasn't set one
          accountNumberHash: string | null,    // stable 6-character opaque identifier for the source account. Use to distinguish actuals across multiple accounts under the same \`source\` (e.g. two different Isracard cards on the same customer). Same account → same hash across every response. Not a cryptographic hash and not the raw account number. Null when no matching identifier is available.
          isInstallment: boolean,              // true when part of a payment plan
          paymentNumber: number,               // 1..totalNumberOfPayments (installments only)
          totalNumberOfPayments: number,       // total installments (installments only)
          expense: string,                     // system-computed transaction label (Hebrew), e.g. "ביגוד", "מסעדות". NOT the envelope's category name — use details.trackingCategory.name for that
          // ... plus sequenceId, placement, transactionBudgetDate, isPostponed,
          //     sourceType, source, monthsInterval when applicable
        }
      ]
    }
  ],
  excluded: [...],                            // transactions the customer marked as one-offs
  _meta: { source: "riseup-external-api", tokenRef: string }
}

Amount spent in an expense envelope = sum of its actuals' billingAmount minus the sum of their incomeAmount (refunds). For an income envelope (e.g. salary), the amount received = sum of its actuals' incomeAmount.

Envelope type semantics:
  - 'fixed': Fixed expenses and incomes (rent, subscriptions, insurance, salary) — recurring with known amounts. originalAmount is the predicted amount and does not change. What this fixed item comes to this month, as the RiseUp app shows it: once it has actuals, the amount actually paid (or received) = the amount from its actuals; if it has no actuals and its balanceDate is before lastUpdatedAt, 0 (it did not arrive this month); otherwise still the predicted originalAmount.
  - 'trackingCategory': A category the customer tracks against a target, e.g. "סופר" with a 2,900 ILS target. Compare the amount spent with originalAmount, and call the category by its name as shown in the app (see details.trackingCategory.name). When isCustomPrediction is true the customer set the target; a customer-set target of 0 means no budget for this category. When it is false RiseUp estimated the target from the customer's history — say so rather than calling it the customer's goal. For a weekly category, add up its weekly envelopes to answer about the whole month; judge over/under for a single week only when the customer asks about a week. A partial week at the start or end of the month has a smaller target. The savings category ("__saving-hidden-category__", type "saving") holds money put aside — never describe it as overspending.
  - 'variable': "Other" day-to-day discretionary spending — not fixed and not in a tracked category. When users ask about "variable expenses" they mean this bucket. It has no target; report the amount spent.
  - 'variableIncome': Variable (non-fixed) income — freelance, one-off payments, etc. It has no target.
  - 'riseupGoal': A savings goal the customer set through the RiseUp product.

\`excluded\` contains transactions the customer marked as one-offs to exclude from the monthly cashflow — atypical spending they don't want counted as regular. Same shape as the transactions inside envelope actuals.

A cashflow month can start on a day other than the 1st; \`budgetDate\` names it.

All money fields are in Israeli shekels (ILS), except an actual's originalAmount (see above), and may carry long decimals; round to whole shekels when talking to the customer. On each actual, \`billingAmount\` is populated for expenses and \`incomeAmount\` for incomes — **exactly one is non-null per transaction** (use \`isIncome\` to pick which). On envelopes, \`originalAmount\` is positive for expenses and negative for incomes (e.g. salary). On actuals, \`billingAmount\` and \`incomeAmount\` are always positive; use \`isIncome\` to tell them apart.`,
      inputSchema: {
        date: BUDGET_DATE.describe(
          'The month to fetch. Accepts "YYYY-MM" (e.g. "2026-05"), "current" (the current cashflow month), or "previous" (the previous cashflow month).',
        ),
      },
    },
    async ({ date }) => {
      return jsonToolResult(await fetchBudget(date, loadConfigFromEnv()));
    },
  );
}
