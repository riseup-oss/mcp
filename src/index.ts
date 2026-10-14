#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerBudgetTool } from './tools/budget.js';
import { registerTransactionsTool } from './tools/transactions.js';
import { registerMortgagesTool } from './tools/mortgages.js';
import { registerBalancesTools } from './tools/balances.js';
import { registerBenchmarksTool } from './tools/benchmarks.js';

const server = new McpServer({
  name: 'riseup-mcp',
  version: '0.4.0',
});

registerBudgetTool(server);
registerTransactionsTool(server);
registerMortgagesTool(server);
registerBalancesTools(server);
registerBenchmarksTool(server);

const transport = new StdioServerTransport();
await server.connect(transport);
