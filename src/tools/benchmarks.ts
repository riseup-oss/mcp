import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { loadConfigFromEnv, riseupGet, type RiseupClientConfig } from '../client.js';
import { jsonToolResult } from './tool-result.js';

export const SPEND_AREAS = [
  'eating_out', 'economy', 'electricity', 'insurance', 'mortgage', 'loan', 'communication', 'car', 'public_transport',
] as const;

export async function fetchBenchmarks(spendAreas: readonly string[] | undefined, config: RiseupClientConfig): Promise<unknown> {
  const query = new URLSearchParams();
  (spendAreas ?? []).forEach(spendArea => query.append('spendAreas', spendArea));
  const qs = query.toString();
  return riseupGet(config, `/api/external/benchmarks${qs ? `?${qs}` : ''}`);
}

export function registerBenchmarksTool(server: McpServer): void {
  server.registerTool(
    'get_benchmarks_data',
    {
      description: `Compare the customer's spending in a category with a group of similar RiseUp customers. Similar customers are chosen by a model using city, average income, number of kids, marital status and other parameters. Use this when the user asks whether they spend a lot or a little, or how they compare to others.

Benchmarks exist only for these spend areas:
  - "eating_out"       — אוכל בחוץ (eating out)
  - "economy"          — כלכלה (groceries / household)
  - "electricity"      — חשמל
  - "insurance"        — ביטוח
  - "mortgage"         — משכנתא
  - "loan"             — הלוואה
  - "communication"    — תקשורת (phone, internet, TV)
  - "car"              — רכב
  - "public_transport" — תחבורה ציבורית
Not every customer has a benchmark in every area.

Input parameters:
  - spendAreas (string[], optional): Spend areas to return, from the list above. Omit for all available.

Response shape:
{
  benchmarks: [                              // one entry per spend area with a benchmark; a missing area means no benchmark is available
    {
      spendArea: string,                     // one of the spend areas above
      category: string,                      // the spend area's Hebrew category name, e.g. "כלכלה"
      customerSpend: number,                 // the customer's typical monthly spend in this area over the last 6 months (ILS) — mention the period
      customerSpendPercentile: number,       // % of similar customers who spend LESS than this customer. 65 → spends more than 65% of them; 18 → spends less than 82% of them
      similarCustomersMean: number,          // average monthly spend of the similar customers (ILS)
      comparedBy: {                          // the customer's values for the main parameters similar customers were matched on (Hebrew); null when unknown / not used
        numberOfKids: string | null,         // e.g. "ילד אחד", "ללא ילדים"
        maritalStatus: string | null,        // e.g. "נשוי/אה"
        city: string | null,                 // e.g. "תל אביב"
        monthlyIncomeRange: { from: number, to: number | null } | null,  // monthly income bucket (ILS); to=null means "and above"
      },
    },
    ...
  ],
  _meta: { source: "riseup-external-api", tokenRef: string }
}

Use \`comparedBy\` to explain who the customer is compared with.`,
      inputSchema: {
        spendAreas: z.array(z.enum(SPEND_AREAS)).optional().describe(
          'Spend areas to return, from the list above. Omit for all.',
        ),
      },
    },
    async ({ spendAreas }) => jsonToolResult(await fetchBenchmarks(spendAreas, loadConfigFromEnv())),
  );
}
