import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fetchBudget } from '../src/tools/budget.js';
import { loadConfigFromEnv, riseupGet, type RiseupClientConfig } from '../src/client.js';

const VALID_TOKEN = 'riseup_pat_abcdef1234567890';
const CONFIG: RiseupClientConfig = {
  pat: VALID_TOKEN,
  apiBase: 'http://localhost:3000',
};

beforeEach(() => {
  jest.restoreAllMocks();
  delete process.env.RISEUP_PAT;
  delete process.env.RISEUP_API_BASE;
});

describe('loadConfigFromEnv', () => {
  it('returns a config when RISEUP_PAT is set with the riseup_pat_ prefix', () => {
    process.env.RISEUP_PAT = VALID_TOKEN;
    const config = loadConfigFromEnv();
    expect(config.pat).toBe(VALID_TOKEN);
    expect(config.apiBase).toBe('https://input.riseup.co.il');
  });

  it('honors RISEUP_API_BASE override and strips trailing slash', () => {
    process.env.RISEUP_PAT = VALID_TOKEN;
    process.env.RISEUP_API_BASE = 'http://localhost:3000/';
    expect(loadConfigFromEnv().apiBase).toBe('http://localhost:3000');
  });

  it('throws when RISEUP_PAT is missing', () => {
    expect(() => loadConfigFromEnv()).toThrow(/RISEUP_PAT environment variable is required/);
  });

  it('throws when RISEUP_PAT does not have the riseup_pat_ prefix', () => {
    process.env.RISEUP_PAT = 'something-else';
    expect(() => loadConfigFromEnv()).toThrow(/must start with "riseup_pat_"/);
  });

  it('throws when RISEUP_API_BASE is plain http on a non-local host', () => {
    process.env.RISEUP_PAT = VALID_TOKEN;
    process.env.RISEUP_API_BASE = 'http://example.com';
    expect(() => loadConfigFromEnv()).toThrow(/must use https/);
  });

  it('throws when RISEUP_API_BASE contains URL credentials (user@host)', () => {
    process.env.RISEUP_PAT = VALID_TOKEN;
    process.env.RISEUP_API_BASE = 'https://someuser@input.riseup.co.il';
    expect(() => loadConfigFromEnv()).toThrow(/must not contain URL credentials/);
  });

  it('throws when RISEUP_API_BASE contains URL credentials (user:pass@host)', () => {
    process.env.RISEUP_PAT = VALID_TOKEN;
    process.env.RISEUP_API_BASE = 'https://someuser:secret@input.riseup.co.il';
    expect(() => loadConfigFromEnv()).toThrow(/must not contain URL credentials/);
  });

  it('allows http for localhost (local-dev exception)', () => {
    process.env.RISEUP_PAT = VALID_TOKEN;
    process.env.RISEUP_API_BASE = 'http://localhost:6040';
    expect(loadConfigFromEnv().apiBase).toBe('http://localhost:6040');
  });

  it('allows http for 127.0.0.1 (local-dev exception)', () => {
    process.env.RISEUP_PAT = VALID_TOKEN;
    process.env.RISEUP_API_BASE = 'http://127.0.0.1:6040';
    expect(loadConfigFromEnv().apiBase).toBe('http://127.0.0.1:6040');
  });

  it('allows http for [::1] (IPv6 loopback)', () => {
    process.env.RISEUP_PAT = VALID_TOKEN;
    process.env.RISEUP_API_BASE = 'http://[::1]:6040';
    expect(loadConfigFromEnv().apiBase).toBe('http://[::1]:6040');
  });

  it('throws when RISEUP_API_BASE is not a valid URL', () => {
    process.env.RISEUP_PAT = VALID_TOKEN;
    process.env.RISEUP_API_BASE = 'not-a-url';
    expect(() => loadConfigFromEnv()).toThrow(/not a valid URL/);
  });

  it('emits a stderr warning when RISEUP_API_BASE host is not riseup.co.il', () => {
    process.env.RISEUP_PAT = VALID_TOKEN;
    process.env.RISEUP_API_BASE = 'https://api.example.com';
    const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    loadConfigFromEnv();
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringMatching(/api\.example\.com.*not a riseup\.co\.il host/));
  });

  it('does NOT warn for hosts under riseup.co.il', () => {
    process.env.RISEUP_PAT = VALID_TOKEN;
    process.env.RISEUP_API_BASE = 'https://staging.riseup.co.il';
    const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    loadConfigFromEnv();
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('does NOT warn for localhost (local-dev exception)', () => {
    process.env.RISEUP_PAT = VALID_TOKEN;
    process.env.RISEUP_API_BASE = 'http://localhost:6040';
    const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    loadConfigFromEnv();
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('emits the untrusted-host warning at most once per host per process', () => {
    process.env.RISEUP_PAT = VALID_TOKEN;
    process.env.RISEUP_API_BASE = 'https://once-only.example.com';
    const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    loadConfigFromEnv();
    loadConfigFromEnv();
    loadConfigFromEnv();
    expect(stderrSpy).toHaveBeenCalledTimes(1);
  });
});

describe('riseupGet', () => {
  it('calls fetch with the configured base URL + path and a Bearer Authorization header', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ));
    await riseupGet(CONFIG, '/api/external/budget/2026-05');
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3000/api/external/budget/2026-05',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: `Bearer ${VALID_TOKEN}`,
          Accept: 'application/json',
        }),
      }),
    );
  });

  it('throws a clear 401 message when the token is rejected', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 401 }));
    await expect(riseupGet(CONFIG, '/api/external/budget/current')).rejects.toThrow(/PAT was rejected/);
  });

  it('throws a clear 403 message when scopes are insufficient', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 403 }));
    await expect(riseupGet(CONFIG, '/api/external/budget/current')).rejects.toThrow(/lacks the required scope/);
  });

  it('surfaces the underlying network error with URL + cause code', async () => {
    const cause = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
    const fetchErr = Object.assign(new TypeError('fetch failed'), { cause });
    jest.spyOn(globalThis, 'fetch').mockRejectedValueOnce(fetchErr);
    await expect(riseupGet(CONFIG, '/api/external/budget/current')).rejects.toThrow(
      /Network error calling http:\/\/localhost:3000\/api\/external\/budget\/current: ECONNREFUSED/,
    );
  });
});

describe('fetchBudget', () => {
  it('calls /api/external/budget/:date and returns the parsed JSON body', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(
      JSON.stringify({ month: '2026-05', total: 1234 }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ));
    const result = await fetchBudget('2026-05', CONFIG);
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3000/api/external/budget/2026-05',
      expect.anything(),
    );
    expect(result).toEqual({ month: '2026-05', total: 1234 });
  });

  it('URL-encodes the date path component', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('{}', { status: 200 }));
    await fetchBudget('current', CONFIG);
    expect((fetchSpy.mock.calls[0][0] as string)).toBe('http://localhost:3000/api/external/budget/current');
  });
});
