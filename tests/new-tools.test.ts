import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { type RiseupClientConfig } from '../src/client.js';
import { fetchMortgagesData } from '../src/tools/mortgages.js';
import { fetchCurrentBankBalances, fetchHistoricalBankBalances } from '../src/tools/balances.js';
import { fetchBenchmarks } from '../src/tools/benchmarks.js';

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
