import { afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { type RiseupClientConfig } from '../src/client.js';
import { fetchMortgagesData } from '../src/tools/mortgages.js';
import { fetchCurrentBankBalances, fetchHistoricalBankBalances } from '../src/tools/balances.js';
import { fetchBenchmarks } from '../src/tools/benchmarks.js';
import { fetchFutureBankBalancesPrediction } from '../src/tools/future-balances.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { fetchInvestmentsData, fetchSavingsData, registerSavingsInvestmentsTools } from '../src/tools/savings-investments.js';
import { jsonToolResult } from '../src/tools/tool-result.js';

const VALID_TOKEN = 'riseup_pat_TEST_FIXTURE_not_a_real_token';
const CONFIG: RiseupClientConfig = {
  pat: VALID_TOKEN,
  apiBase: 'http://localhost:3000',
};

function mockFetch(body: unknown = {}) {
  return jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(
    JSON.stringify(body),
    { status: 200, headers: { 'content-type': 'application/json' } },
  ));
}

beforeEach(() => {
  jest.restoreAllMocks();
});

describe('fetchMortgagesData', () => {
  it('calls /api/external/mortgages with no query string and the Bearer token', async () => {
    const fetchSpy = mockFetch({ hasMortgageData: false });
    const result = await fetchMortgagesData(CONFIG);
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3000/api/external/mortgages',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${VALID_TOKEN}` }),
      }),
    );
    expect(result).toEqual({ hasMortgageData: false });
  });
});

describe('fetchCurrentBankBalances', () => {
  it('calls /api/external/balances/current and returns the parsed body', async () => {
    const fetchSpy = mockFetch({ balances: [] });
    await expect(fetchCurrentBankBalances(CONFIG)).resolves.toEqual({ balances: [] });
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('http://localhost:3000/api/external/balances/current');
  });
});

describe('fetchHistoricalBankBalances', () => {
  it('calls /api/external/balances/history with daysBack', async () => {
    const fetchSpy = mockFetch({ accounts: [] });
    await fetchHistoricalBankBalances(30, CONFIG);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('http://localhost:3000/api/external/balances/history?daysBack=30');
  });
});

describe('fetchBenchmarks', () => {
  it('calls /api/external/benchmarks with no query string when no spend areas given', async () => {
    const fetchSpy = mockFetch({ benchmarks: [] });
    await fetchBenchmarks(undefined, CONFIG);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('http://localhost:3000/api/external/benchmarks');
  });

  it('sends each spend area as a repeated query param', async () => {
    const fetchSpy = mockFetch({ benchmarks: [] });
    await fetchBenchmarks(['eating_out', 'economy'], CONFIG);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      'http://localhost:3000/api/external/benchmarks?spendAreas=eating_out&spendAreas=economy',
    );
  });

  it('treats an empty list like no filter', async () => {
    const fetchSpy = mockFetch({ benchmarks: [] });
    await fetchBenchmarks([], CONFIG);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('http://localhost:3000/api/external/benchmarks');
  });
});

describe('fetchFutureBankBalancesPrediction', () => {
  it('calls /api/external/future-balances with futureDateForPrediction', async () => {
    const fetchSpy = mockFetch({ accounts: [] });
    await expect(fetchFutureBankBalancesPrediction('2026-11-20', CONFIG)).resolves.toEqual({ accounts: [] });
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      'http://localhost:3000/api/external/future-balances?futureDateForPrediction=2026-11-20',
    );
  });
});

describe('fetchSavingsData', () => {
  it('calls /api/external/savings with no query string and the Bearer token', async () => {
    const fetchSpy = mockFetch({ savings: [] });
    await expect(fetchSavingsData(CONFIG)).resolves.toEqual({ savings: [] });
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3000/api/external/savings',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${VALID_TOKEN}` }),
      }),
    );
  });
});

describe('fetchInvestmentsData', () => {
  it('calls /api/external/investments with no query string and the Bearer token', async () => {
    const fetchSpy = mockFetch({ investments: [] });
    await expect(fetchInvestmentsData(CONFIG)).resolves.toEqual({ investments: [] });
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3000/api/external/investments',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${VALID_TOKEN}` }),
      }),
    );
  });
});

describe('get_savings_data / get_investments_data tool handlers', () => {
  type ToolHandler = (args: Record<string, never>) => Promise<unknown>;
  const ENV_KEYS = ['RISEUP_PAT', 'RISEUP_API_BASE'] as const;
  const savedEnv = Object.fromEntries(ENV_KEYS.map(key => [key, process.env[key]]));

  function captureHandlers(): Record<string, ToolHandler> {
    const handlers: Record<string, ToolHandler> = {};
    const fakeServer = {
      registerTool: (name: string, _config: unknown, handler: ToolHandler) => {
        handlers[name] = handler;
      },
    } as unknown as McpServer;
    registerSavingsInvestmentsTools(fakeServer);
    return handlers;
  }

  beforeEach(() => {
    process.env.RISEUP_PAT = VALID_TOKEN;
    process.env.RISEUP_API_BASE = CONFIG.apiBase;
  });

  afterAll(() => {
    ENV_KEYS.forEach(key => {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    });
  });

  it('registers the tools under their documented names', () => {
    expect(Object.keys(captureHandlers())).toEqual(['get_savings_data', 'get_investments_data']);
  });

  it.each([
    ['get_savings_data', '/api/external/savings', { savings: [{ id: 'a1' }] }],
    ['get_investments_data', '/api/external/investments', { investments: [{ bankIdentifier: 'leumi' }] }],
  ])('%s calls %s and returns the body as a JSON tool result', async (name, path, body) => {
    const fetchSpy = mockFetch(body);

    const result = await captureHandlers()[name]!({});

    expect(fetchSpy.mock.calls[0]?.[0]).toBe(`http://localhost:3000${path}`);
    expect(result).toEqual(jsonToolResult(body));
  });
});
