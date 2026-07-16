import { SuiteCiIntegration } from '../types/index.js';

/**
 * Map the raw GET /playwright-autopilot/suites/:id/ci backend response into
 * the public CLI shape. Strips backend-only sensitive fields (access_token,
 * webhook_secret, user_id) and reduces the inbound webhook token to its
 * last 4 chars so it's safe to display in `obs suite ci status` output.
 *
 * Returns null when the suite has no CI integration (backend returns
 * null / undefined / non-object).
 */
export function mapSuiteCiIntegration(raw: unknown): SuiteCiIntegration | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const token = typeof r.inbound_webhook_token === 'string' ? r.inbound_webhook_token : null;
  const asString = (value: unknown): string => (typeof value === 'string' ? value : '');
  return {
    id: Number(r.id),
    suite_id: String(r.suite_id),
    provider: asString(r.provider),
    repo_identifier: asString(r.repo_identifier),
    branch: asString(r.branch),
    comment_on_pr: Boolean(r.comment_on_pr),
    set_status_check: Boolean(r.set_status_check),
    check_name: asString(r.check_name),
    wait_for_ci: Boolean(r.wait_for_ci),
    inbound_webhook_token_last4: token ? token.slice(-4) : null,
    github_installation_id:
      typeof r.github_installation_id === 'number' ? r.github_installation_id : null,
    last_triggered_at: typeof r.last_triggered_at === 'string' ? r.last_triggered_at : null,
    created_at: asString(r.created_at),
    updated_at: asString(r.updated_at),
  };
}
