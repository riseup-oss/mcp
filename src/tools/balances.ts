import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { loadConfigFromEnv, riseupGet, type RiseupClientConfig } from '../client.js';
import { jsonToolResult } from './tool-result.js';

const MAX_DAYS_BACK = 90;

const ACCOUNT_FIELDS_DOC = `      source: string,                        // bank source identifier, e.g. "leumiBank", "poalim"
      accountNickname: string | null,        // customer-defined label for the account, set in the RiseUp app; null if not set
      accountNumberHash: string | null,      // stable 6-character opaque account identifier — same account → same hash across every RiseUp tool (e.g. get_transactions). Not the account number.`;

export async function fetchCurrentBankBalances(config: RiseupClientConfig): Promise<unknown> {
  return riseupGet(config, '/api/external/balances/current');
}

export async function fetchHistoricalBankBalances(daysBack: number, config: RiseupClientConfig): Promise<unknown> {
  const query = new URLSearchParams({ daysBack: String(daysBack) });
  return riseupGet(config, `/api/external/balances/history?${query}`);
}

export function registerBalancesTools(server: McpServer): void {
  server.registerTool(
    'get_current_bank_balances_data',
    {
      description: `Get the current balance of each of the customer's bank accounts, with when it was last updated and the account's approved overdraft limit (מסגרת אשראי בעו"ש). Use this when the user asks how much money they have, about their current bank balance / overdraft, what their overdraft limit is, or how much of it they can still use. For balances over time use \`get_historical_bank_balances_data\`.

No input parameters.

Response shape:
{
  balances: [                                // one entry per bank account, most recently updated first
    {
${ACCOUNT_FIELDS_DOC}
      balance: number,                       // current balance (ILS); negative means overdraft
      lastUpdated: ISO datetime,             // when this balance was last updated from the bank
      overdraftLimit: number | null,         // approved overdraft limit (ILS) — how far below zero the account may go, as a positive amount. 0 = the account has no overdraft limit. null = unknown (e.g. the bank doesn't provide it): don't assume any limit
      availableOverdraft: number | null,     // how much of the overdraft limit can still be used at the current balance (ILS): the full limit while the balance is 0 or positive, the limit minus the overdraft once negative, 0 once the balance reaches or passes the limit. null when overdraftLimit is null
      overdraftLimitUpdatedAt: "YYYY-MM-DD" | null, // the day the overdraft limit was taken from the bank; null when overdraftLimit is null
    },
    ...
  ],
  _meta: { source: "riseup-external-api", tokenRef: string }
}

Balances come from the bank connection, so an account whose connection stopped updating keeps its last known balance. Always mention when each balance was last updated, and point out balances that are more than a couple of days old.

Overdraft: the money the customer can still spend from an account before hitting its limit is balance + availableOverdraft while the balance is positive, and availableOverdraft once it's negative. A negative balance with availableOverdraft 0 means the account is at or past its limit. The limit may be from a different day than the balance — mention overdraftLimitUpdatedAt when it's more than a few days old. When overdraftLimit is null, say the limit is unknown rather than treating it as 0 or as no limit.`,
      inputSchema: {},
    },
    async () => jsonToolResult(await fetchCurrentBankBalances(loadConfigFromEnv())),
  );

  server.registerTool(
    'get_historical_bank_balances_data',
    {
      description: `Get the customer's daily bank balances over the last N days (up to ${MAX_DAYS_BACK}), per bank account, with the minimum, maximum and average balance of the period. Use this when the user asks how their balance changed, when they were in overdraft, or their lowest / highest / average balance.

Input parameters:
  - daysBack (integer, required): How many days back to include, 1–${MAX_DAYS_BACK}. Balance history is not available beyond ${MAX_DAYS_BACK} days.

Response shape:
{
  accounts: [                                // one entry per bank account with balances in the period
    {
${ACCOUNT_FIELDS_DOC}
      minBalance: number,                    // lowest balance in the period (ILS)
      maxBalance: number,                    // highest balance in the period (ILS)
      avgBalance: number,                    // average of the daily balances in the period (ILS)
      balances: [                            // one balance per day it was recorded, latest first
        { date: "YYYY-MM-DD", balance: number },
        ...
      ],
    },
    ...
  ],
  _meta: { source: "riseup-external-api", tokenRef: string }
}

Days without a recorded balance (e.g. the bank connection didn't update) are missing from \`balances\` rather than filled in.`,
      inputSchema: {
        daysBack: z.number().int().min(1).max(MAX_DAYS_BACK).describe(
          `How many days back to include, 1–${MAX_DAYS_BACK}.`,
        ),
      },
    },
    async ({ daysBack }) => jsonToolResult(await fetchHistoricalBankBalances(daysBack, loadConfigFromEnv())),
  );
}
