import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { loadConfigFromEnv, riseupGet, type RiseupClientConfig } from '../client.js';
import { jsonToolResult } from './tool-result.js';

export async function fetchMortgagesData(config: RiseupClientConfig): Promise<unknown> {
  return riseupGet(config, '/api/external/mortgages');
}

export function registerMortgagesTool(server: McpServer): void {
  server.registerTool(
    'get_mortgages_data',
    {
      description: `Get the customer's mortgage data from RiseUp: remaining balance, remaining interest and principal, monthly payment, the individual mortgage parts (tracks), how much the customer actually paid toward the mortgage in their cashflow, and how much they could save with RiseUp's mortgage product. Use this when the user asks about their mortgage.

No input parameters. Mortgage payments in the cashflow are summed over the customer's previous (last complete) cashflow month.

Response shape:
{
  paymentsCashflowMonth: "YYYY-MM" | null,   // the previous cashflow month, which mortgagePaymentsInCashflow was summed over; null if it has no transactions
  hasMortgagePaymentsInCashflow: boolean,    // true if mortgage payments appear in that month's cashflow
  mortgagePaymentsInCashflow: number,        // total mortgage payments in that month's cashflow (ILS)
  hasMortgageData: boolean,                  // true if RiseUp has the customer's mortgage details. When false, the fields below are absent.
  monthlyPayment: number,                    // expected monthly payment according to the mortgage details (ILS)
  totalRemainingAmount: number,              // total amount left to pay, principal + interest (ILS)
  remainingInterestAmount: number,           // interest part of totalRemainingAmount (ILS) — an amount, not a rate
  remainingPrincipalAmount: number,          // principal part of totalRemainingAmount (ILS)
  parts: [                                   // the mortgage's parts (tracks)
    {
      remainingAmount: number,               // current balance of this part (ILS)
      remainingMonths: number | null,        // months left to pay on this part
      mortgageType: string,                  // PRIME_LINKED, VARIABLE_CPI_LINKED, FIXED_CPI_LINKED, FIXED_UNLINKED, VARIABLE_UNLINKED, ELIGIBILITY, GRANT or UNKNOWN
      interestRates: object | null,          // current interest data of this part; its keys depend on the type (fixed / variable / prime-based), e.g. { primeRate: 2.5 }
    },
    ...
  ],
  riseupSavingsPotential: {                  // what RiseUp's mortgage product could save. The response includes both options so they can be compared. They're alternatives: the customer can choose one of them, and choosing one rules out the other — the two savings can't be combined
    totalCostSaving: number | null,          // total cost saving while keeping the same monthly payment; null when there's no improvement
    monthlyPaymentSaving: number | null,     // monthly payment saving while keeping the same total cost; null when there's no improvement
  },
  _meta: { source: "riseup-external-api", tokenRef: string }
}

All money values are in Israeli shekels (ILS). When presenting savings, say they are alternatives: the customer can choose one of them, and choosing one rules out the other — the two savings can't be combined.`,
      inputSchema: {},
    },
    async () => jsonToolResult(await fetchMortgagesData(loadConfigFromEnv())),
  );
}
