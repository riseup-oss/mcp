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
      description:
        'Get the customer\'s RiseUp budget for a given month. Date accepts "YYYY-MM" (e.g. "2026-05"), "current", or "previous".',
      inputSchema: { date: BUDGET_DATE },
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
