import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { fetchTransactions, registerTransactionsTool } from '../src/tools/transactions.js';
import { type RiseupClientConfig } from '../src/client.js';

const VALID_TOKEN = 'riseup_pat_abcdef1234567890';
const CONFIG: RiseupClientConfig = {
  pat: VALID_TOKEN,
  apiBase: 'http://localhost:3000',
};

beforeEach(() => {
  jest.restoreAllMocks();
});

describe('fetchTransactions', () => {
  it('calls /api/external/transactions with no query string when no filters given', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(
      JSON.stringify({ transactions: [] }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ));
    await fetchTransactions({}, CONFIG);
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3000/api/external/transactions',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${VALID_TOKEN}` }),
      }),
    );
  });

  it('sends cashflowMonth as a query param', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(
      '{"transactions":[]}', { status: 200 },
    ));
    await fetchTransactions({ cashflowMonth: '2026-06' }, CONFIG);
    expect(fetchSpy.mock.calls[0][0]).toBe(
      'http://localhost:3000/api/external/transactions?cashflowMonth=2026-06',
    );
  });

  it('sends transactionDate as a query param', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(
      '{"transactions":[]}', { status: 200 },
    ));
    await fetchTransactions({ transactionDate: '2026-06-15' }, CONFIG);
    expect(fetchSpy.mock.calls[0][0]).toBe(
      'http://localhost:3000/api/external/transactions?transactionDate=2026-06-15',
    );
  });

  it('combines all three filters in the query string', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(
      '{"transactions":[]}', { status: 200 },
    ));
    await fetchTransactions(
      { cashflowMonth: '2026-06', transactionDate: '2026-06-15', businessName: 'restaurant' },
      CONFIG,
    );
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain('cashflowMonth=2026-06');
    expect(url).toContain('transactionDate=2026-06-15');
    expect(url).toContain('businessName=restaurant');
  });

  it('URL-encodes businessName with special characters', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(
      '{"transactions":[]}', { status: 200 },
    ));
    await fetchTransactions({ businessName: 'Café & Bar' }, CONFIG);
    expect(fetchSpy.mock.calls[0][0]).toBe(
      'http://localhost:3000/api/external/transactions?businessName=Caf%C3%A9+%26+Bar',
    );
  });

  it('returns the parsed JSON body', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(
      JSON.stringify({ transactions: [{ transactionId: 't1' }], _meta: { source: 'x' } }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ));
    const result = await fetchTransactions({ cashflowMonth: 'current' }, CONFIG);
    expect(result).toEqual({ transactions: [{ transactionId: 't1' }], _meta: { source: 'x' } });
  });

  it('omits empty-string filters from the query', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(
      '{"transactions":[]}', { status: 200 },
    ));
    await fetchTransactions({ cashflowMonth: '2026-06', businessName: '' }, CONFIG);
    expect(fetchSpy.mock.calls[0][0]).toBe(
      'http://localhost:3000/api/external/transactions?cashflowMonth=2026-06',
    );
  });
});

describe('get_transactions tool handler', () => {
  type ToolHandler = (args: {
    cashflowMonth?: string,
    transactionDate?: string,
    businessName?: string,
  }) => Promise<{ isError?: boolean, content: { type: string, text: string }[] }>;

  function captureHandler(): ToolHandler {
    let handler: ToolHandler | undefined;
    const fakeServer = {
      registerTool: (_name: string, _config: unknown, h: ToolHandler) => {
        handler = h;
      },
    } as unknown as McpServer;
    registerTransactionsTool(fakeServer);
    return handler!;
  }

  it('rejects a businessName-only call before hitting the network', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    const handler = captureHandler();
    const result = await handler({ businessName: 'restaurant' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('cashflowMonth');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects a no-filter call before hitting the network', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    const handler = captureHandler();
    const result = await handler({});
    expect(result.isError).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
