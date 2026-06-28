/**
 * Host allowlist for outbound CLI requests.
 *
 * The API base URL is user-overridable (`--api-url`, `OBS_API_URL`, a CWD
 * `.obs.config.json`), so the auth token (`x-obs1-cli`) must never be attached
 * to a request whose destination host is not ObserveOne-owned. This is the
 * single source of truth for "is it safe to send credentials here", used by
 * both the axios request interceptor and the SSE client.
 */

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * Returns true when it is safe to send the API token to `rawUrl`'s host:
 * the canonical `observeone.com` and any `*.observeone.com` subdomain, plus
 * loopback addresses (the user's own machine — used for local dev and e2e
 * against a local backend, and never a remote exfiltration target).
 *
 * Unparseable URLs are treated as not allowed.
 */
export function isAllowedHost(rawUrl: string | undefined): boolean {
  if (!rawUrl) return false;

  let host: string;
  try {
    host = new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return false;
  }

  if (host === 'observeone.com' || host.endsWith('.observeone.com')) return true;
  if (LOOPBACK_HOSTS.has(host)) return true;

  return false;
}
