const DEFAULT_API_BASE = 'https://input.riseup.co.il';
const PAT_PREFIX = 'riseup_pat_';
const TRUSTED_HOST_ROOT = 'riseup.co.il';
const TRUSTED_HOST_SUFFIX = `.${TRUSTED_HOST_ROOT}`;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

// loadConfigFromEnv() is called on every tool invocation. Track which untrusted
// hosts we've already warned about so the stderr line is emitted once per host
// per process, not on every call.
const _warnedHosts = new Set<string>();

export type RiseupClientConfig = {
  pat: string;
  apiBase: string;
};

export function loadConfigFromEnv(): RiseupClientConfig {
  const pat = process.env.RISEUP_PAT;
  if (!pat) {
    throw new Error(
      'RISEUP_PAT environment variable is required. Create a token at https://input.riseup.co.il/developer/tokens',
    );
  }
  if (!pat.startsWith(PAT_PREFIX)) {
    throw new Error(`RISEUP_PAT must start with "${PAT_PREFIX}" — got a token that looks malformed.`);
  }
  const rawBase = process.env.RISEUP_API_BASE ?? DEFAULT_API_BASE;
  const apiBase = _validateApiBase(rawBase).replace(/\/$/, '');
  return { pat, apiBase };
}

function _validateApiBase(rawBase: string): string {
  let url: URL;
  try {
    url = new URL(rawBase);
  } catch {
    throw new Error(`RISEUP_API_BASE is not a valid URL: "${rawBase}"`);
  }
  // Reject URL credentials (https://user:pass@host). Auth is done via the
  // Bearer header from RISEUP_PAT; credentials in the URL would only leak
  // into error messages on network failures (which get logged by clients).
  if (url.username || url.password) {
    throw new Error(
      'RISEUP_API_BASE must not contain URL credentials (user:pass@). '
      + 'Authenticate via RISEUP_PAT instead.',
    );
  }
  // Node's URL parser keeps IPv6 hostnames bracketed (`[::1]`); normalize so
  // the LOCAL_HOSTS check matches the bare `::1`.
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const isLocal = LOCAL_HOSTS.has(hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocal)) {
    throw new Error(
      `RISEUP_API_BASE must use https (got "${url.protocol}//${url.host}"). `
      + `Plain http is only allowed for loopback hosts (localhost, 127.0.0.1, ::1).`,
    );
  }
  const isTrustedHost = hostname === TRUSTED_HOST_ROOT || hostname.endsWith(TRUSTED_HOST_SUFFIX);
  if (!isTrustedHost && !isLocal && !_warnedHosts.has(url.host)) {
    // Stderr only — don't throw. A test/staging host outside riseup.co.il may be intentional,
    // but the user should see this so a typo or hostile override is obvious. Emit once
    // per host per process (loadConfigFromEnv is called on every tool invocation).
    process.stderr.write(
      `WARNING: RISEUP_API_BASE host "${url.host}" is not a ${TRUSTED_HOST_ROOT} host. Your PAT will be sent to this host on every call. Make sure this is intentional.\n`,
    );
    _warnedHosts.add(url.host);
  }
  return rawBase;
}

export async function riseupGet<T>(config: RiseupClientConfig, path: string): Promise<T> {
  const url = `${config.apiBase}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.pat}`,
        Accept: 'application/json',
      },
    });
  } catch (e) {
    const cause = (e as { cause?: { code?: string, message?: string } }).cause;
    const detail = cause?.code ?? cause?.message ?? (e as Error).message;
    throw new Error(`Network error calling ${url}: ${detail}`);
  }
  if (response.status === 401) {
    throw new Error('RiseUp PAT was rejected (401). Token may be expired or revoked.');
  }
  if (response.status === 403) {
    throw new Error('RiseUp PAT lacks the required scope (403). Recreate the token with the right scopes selected.');
  }
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`RiseUp API ${response.status}: ${body.slice(0, 200)}`);
  }
  return (await response.json()) as T;
}
