#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerBudgetTool } from './tools/budget.js';
import { registerTransactionsTool } from './tools/transactions.js';

const server = new McpServer({
  name: 'riseup-mcp',
  version: '0.2.0',
});

registerBudgetTool(server);
registerTransactionsTool(server);

const transport = new StdioServerTransport();
await server.connect(transport);
