#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerBudgetTool } from './tools/budget.js';

const server = new McpServer({
  name: 'riseup-mcp',
  version: '0.1.0',
});

registerBudgetTool(server);

const transport = new StdioServerTransport();
await server.connect(transport);
