import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { loadConfigFromEnv, riseupGet, type RiseupClientConfig } from '../client.js';
import { jsonToolResult } from './tool-result.js';

export async function fetchFutureBankBalancesPrediction(
  futureDateForPrediction: string,
  config: RiseupClientConfig,
): Promise<unknown> {
  const query = new URLSearchParams({ futureDateForPrediction });
  return riseupGet(config, `/api/external/future-balances?${query}`);
}

export function registerFutureBalancesTool(server: McpServer): void {
  server.registerTool(
    'get_future_bank_balances_prediction',
    {
      description: `Predict the balance of each of the customer's bank accounts at the end of a future date, assuming no other transactions happen until then. Use this when the user asks what their balance will be on a date, whether they will be in overdraft, or how much will be left before their salary arrives.

For each bank account the prediction starts from the current balance and subtracts expenses / adds incomes of:
  - transactions already known with a billing date from the balance's last update until the future date (inclusive) — e.g. credit card charges that will be billed to the account
  - fixed (recurring) expenses and incomes predicted to be billed until the future date that haven't arrived yet
Variable expenses that haven't happened yet (e.g. future grocery shopping) are NOT included.

Limitations:
  - futureDateForPrediction must be from today until the end of the customer's NEXT cashflow month. Otherwise the call fails with a 400 error explaining the supported range — don't retry with the same date; explain this to the user.
  - Customers with rolling credit (אשראי מתגלגל) on a credit card are not supported — they get an empty \`accounts\` list.
  - Only bank accounts whose balance was updated in the last 2 days are included.
  - An empty \`accounts\` list means there is no future balance prediction for this customer.

Input parameters:
  - futureDateForPrediction (string, required): The date to predict the balance at (end of that day), in YYYY-MM-DD format.

Response shape:
{
  accounts: [                                // one entry per bank account
    {
      bankName: string,                      // the bank's name, e.g. "דיסקונט"
      accountNickname: string | null,        // customer-defined label for the account, set in the RiseUp app; null if not set
      accountNumberHash: string | null,      // stable 6-character opaque account identifier — same account → same hash as in get_current_bank_balances_data. Not the account number.
      currentBalance: number,                // current balance (ILS)
      currentBalanceUpdatedAt: "YYYY-MM-DD HH:MM",  // when the current balance was last updated from the bank
      futureDateForPrediction: "YYYY-MM-DD",
      futurePredictedBalance: number,        // the predicted balance at the end of futureDateForPrediction (ILS); negative means overdraft
      amountToBeBilledUntilFuturePredictionDate: number,  // net total of transactionsBilledUntilFuturePredictionDate: expenses minus incomes (ILS). 0 when there are none
      transactionsBilledUntilFuturePredictionDate: [      // known transactions to be billed to this account until the future date
        { businessName: string, amount: number, isIncome: boolean, billingDate: "YYYY-MM-DD" },
        ...
      ],
      amountFixedPredictedToBeBilledUntilFuturePredictionDate: number,  // net total of fixedTransactionsPredictedToBeBilledUntilFuturePredictionDate: expenses minus incomes (ILS); negative when predicted incomes are larger. 0 when there are none
      fixedTransactionsPredictedToBeBilledUntilFuturePredictionDate: [  // predicted fixed transactions (not yet arrived) until the future date
        { businessName: string, amount: number, isIncome: boolean, predictedBillingDate: "YYYY-MM-DD" },
        ...
      ],
      creditCardsInfo: [                     // one entry per credit card billed to this account with transactions until the future date
        {
          transactionsAmountToBill: number,  // total to be billed from this card until the future date, including predicted fixed transactions (ILS)
          maxAmountPossiblePerMonth: number | null,  // monthly billing cap if the card has rolling credit, else null
        },
        ...
      ],
    },
    ...
  ],
  _meta: { source: "riseup-external-api", tokenRef: string }
}

futurePredictedBalance = currentBalance − amountToBeBilledUntilFuturePredictionDate − amountFixedPredictedToBeBilledUntilFuturePredictionDate.
Transaction \`amount\`s are positive; \`isIncome\` tells incomes from expenses — say so when listing an income.

In the answer, mention the current balance with when it was last updated, the future date, the amount to be billed until then, and that fixed transactions are a prediction that might change.`,
      inputSchema: {
        futureDateForPrediction: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be in YYYY-MM-DD format').describe(
          'The date to predict the balance at (end of that day), YYYY-MM-DD. From today until the end of the next cashflow month.',
        ),
      },
    },
    async ({ futureDateForPrediction }) => jsonToolResult(
      await fetchFutureBankBalancesPrediction(futureDateForPrediction, loadConfigFromEnv()),
    ),
  );
}
