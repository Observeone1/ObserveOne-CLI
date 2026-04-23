# Changelog

All notable changes to the ObserveOne CLI project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.16.0] - 2026-04-23

### Added
- `obs api-key list/create/revoke/toggle` — full API key lifecycle management from the CLI. No more going to the dashboard to bootstrap a new key.
- `obs team list` — list all teams the authenticated user belongs to.
- `obs team members <team-id>` — list members of a team.
- `obs team invite <team-id>` — regenerate and print the team invite code.
- `obs team remove-member <team-id> <user-id>` — remove a team member.
- `obs team update-role <team-id> <user-id> --role <role>` — update a member's role.
- `obs incident comment <id> --message <msg>` — add a comment to an incident.
- `obs incident assign <id> --user <user-id>` — assign an incident to a user.
- `obs incident unassign <id>` — unassign an incident.
- `obs suite toggle-public <id>` — toggle public visibility of a suite.
- `obs suite heal <id>` — trigger self-heal on a suite's failing tests.

## [1.15.1] - 2026-04-23

### Fixed
- `obs monitor update` / `obs check update` — `description: null` from the backend was being sent back on update, causing a 400 Validation error. Now coerced to `""`.
- `obs apply` — monitor `interval` field was silently overwritten with `undefined` due to a field-name mismatch in the API client mapper (`cron_expression` vs `interval`). Dry-run always showed a false interval diff; second apply was never idempotent.
- `obs apply` — api-check `alert_on_failure` was always diffed as changed for checks without a schedule (backend returns `false`, local defaulted to `true`). Apply now uses the remote value as the fallback when the config doesn't set it explicitly.
- `obs apply` — `description: null` in api-check and monitor update payloads caused 400 errors on the second apply run.

## [1.15.0] - 2026-04-23

### Added
- `obs url-monitor toggle-muted <id>` — toggle the muted state of a URL monitor
- `obs check toggle-muted <id>` — toggle the muted state of an API check
- `obs heartbeat toggle-muted <id>` — toggle the muted state of a heartbeat
- `obs heartbeat reset <id>` — reset a heartbeat timer (acknowledges missed pings and restarts the grace window)
- `obs status-page add-monitor <sp-id> <resource-id> --type <type> --name <name> [--order <n>]` — attach a monitor to a status page (supports `url-monitor`, `api-check`, `heartbeat`, `browser-check`)
- `obs status-page remove-monitor <sp-id> <resource-id>` — remove a monitor from a status page

## [1.14.2] - 2026-04-23

### Added
- `obs url-monitor` is now the canonical command name for URL monitors. `obs monitor` continues to work as an alias — no existing scripts or workflows break.

## [1.14.1] - 2026-04-23

### Fixed
- `obs check runs` was silently returning an object instead of an array. Backend PR #99 wrapped `/api-checks/:id/executions` in a `{ executions }` envelope but the CLI client was still reading `response.data` directly as `ResourceRun[]`. Now correctly extracts `response.data.executions`.

## [1.14.0] - 2026-04-23

### Fixed
- **Config-as-code round-trip is now actually idempotent for monitors and API checks.** Three separate gaps were hiding this:
  - `obs export` only serialized a small subset of fields; descriptions, alert-channel attachments (`channel_ids`), request headers, request body, `cron_expression`, and assertions were silently dropped on every export cycle.
  - `obs apply` only compared `name`/`url`/`method`/`timeout_ms`/`alert_on_failure` when deciding whether a resource was "unchanged", so edits to description, headers, assertions, channel_ids, etc. quietly no-op'd. The update payload also only forwarded those same five fields.
  - Both export and apply now detail-hydrate each resource via `getUrlMonitor` / `getApiCheck` so the populated `channels` array is available on the remote side and can be mapped back to `channel_ids` for the comparison. Assertions are compared after stripping DB-owned fields (`id`, `api_check_id`, `created_at`). `body` and `cron_expression` are omitted from the update payload when null to satisfy the backend's zod schema.
- `obs heartbeat create` no longer silently injects `description: "Created via CLI"` when the user omits `--description`. `obs heartbeat update` no longer injects `"Updated via CLI"` when the user doesn't change the description. Both now default to an empty string, matching the `obs apply` fix from v1.13.0.

### Added
- `obs heartbeat create` and `obs heartbeat update` accept `-d, --description` and `-g, --grace` (both flags were missing from the update path entirely; create had no way to set description).

### Changed
- `obs init monitor` template now uses `interval` (the real wire field) instead of the stale `cron_expression` key.
- `obs init monitor` and `obs init check` templates now include a `channel_ids: []` placeholder so users scaffolding a resource from the template can see the alert-channel attachment field without guessing.

### Known Limitations
- Monitor `interval` is not returned by the backend `getUrlMonitor` endpoint, so it cannot round-trip through export → apply. The CLI captures monitor interval correctly on create/update, but cannot read it back from an existing monitor. Tracked as a backend follow-up.
- List endpoints for api_checks return `alert_on_failure` from the schedule record, producing `false` for checks without a schedule. This can cause spurious "update" diffs when those checks are exported and re-applied. Not a regression; pre-existing behavior.

## [1.13.0] - 2026-04-23

### Added
- Field parity on `obs monitor create/update`: `-d, --description`, `--alert-channel-id <id>` (repeatable).
- Field parity on `obs check create/update`: `-d, --description`, `--alert-channel-id <id>` (repeatable), `-i, --interval <cron>`, `--no-alerts`, `--header KEY=VALUE` (repeatable), `--assertion <json>` (repeatable).
- Run history commands: `obs monitor runs <id>`, `obs check runs <id>`, `obs heartbeat runs <id>`. All support `-l, --limit <n>` (default 20) and `--json`.
- `obs apply` now accepts three file shapes:
  - Plural config (existing): `{ "monitors": [...], "api_checks": [...] }`
  - Wrapped single-resource: `{ "monitor": { ... } }`, `{ "heartbeat": { ... } }`, etc.
  - Bare single-resource: `{ "name": "...", "url": "..." }` (type inferred) or with explicit `"type": "monitor"`.
- Input validation helpers in `src/utils/cli-input.ts`: `parseKeyValuePairs`, `parseJsonArrayOption`, `parseNumericIds`, `collectOptionValues` — reusable for repeatable/structured flag parsing.

### Fixed
- `obs apply` for heartbeats no longer drops user-provided fields. Previously, only `name`, `period`, `description`, and `grace_period` were forwarded; any other field in the config was silently discarded. Now spreads the full config.
- `obs apply` no longer fabricates `description: "Created via apply"` or `description: "Updated via CLI"` when the user omits a description. Empty string is passed instead, letting the real value round-trip cleanly through `obs export → obs apply`.

### Requires Backend
- Assertion types `text_contains` and `header` now accepted server-side (previously rejected with `400 Validation failed`).
- `GET /api-checks/:id/executions` now honors `?limit=N` — `obs check runs --limit N` returns the correct count instead of the full history.

## [1.12.0] - 2026-04-22

### Changed (Breaking)
- `obs monitor list`, `obs check list`, and `obs heartbeat list` now return paginated data in `--json` mode as `data: { items, pagination }` instead of a bare array payload.

### Added
- Server-side list filtering for monitors, checks, and heartbeats via `--search`, `--status`, `--is-active`, `--page`, and `--limit`.
- Custom E2E coverage for filtered list flows across monitor, check, and heartbeat resource management.

## [1.11.0] - 2026-04-21

### Added
- `obs apply --dry-run` — preview changes before applying. Fetches remote state, runs the full diff, and prints a git-style colored diff (red for removed values, green for new values) per changed resource. Shows a summary of resources to create, update, and unchanged. Exits without making any API calls.
- `diffObjects()` utility in `src/utils/deep-equal.ts` — returns field-level `{ from, to }` diff between two normalized objects.

## [1.10.0] - 2026-04-21

### Changed (Breaking)
- `obs suite generate <url>` now generates tests by default. The command polls for plan completion, triggers test generation for all planned files in parallel, and waits until all tests are written. Previously it only created the planning phase.
- `--wait` flag removed from help output (still accepted as a hidden no-op with a deprecation warning).

### Added
- `--plan-only` flag on `obs suite generate`: stops after the planning phase without generating test scripts. Useful for reviewing the plan before committing.

## [1.9.1] - 2026-04-20

### Docs
- README now documents the v1.8.0 `obs suite schedule` and `obs suite secrets` commands.
- README has a new Resource Discovery section covering `obs schema`, `obs templates list`, `obs validate`, and `obs init <resource>` (the agent-ready offline chain).

## [1.9.0] - 2026-04-20

### Added
- `obs schema <resource>` — prints the JSON Schema (Draft-07) for a resource type. Supports `-o/--out <path>` to write to a file (auto-creates directories), `--json` for envelope output, and all resource aliases (`api-check` → `check`, etc.). Useful for editor integrations and agent tooling.
- `obs templates list` — lists all available resource templates with name, description, and required fields. Supports `--json`.

### Internal
- `src/utils/schemas.ts` — added `description` field to each resource schema and a `buildJsonSchema()` helper that synthesizes Draft-07 JSON Schema from the bundled templates.
- E2E coverage: `schema.test.ts` (valid/invalid/alias/JSON envelope), `templates.test.ts` (list + JSON envelope).

## [1.8.0] - 2026-04-20

### Added
- `obs suite schedule <id>` — enable/disable a suite schedule and optionally change the cron expression without regenerating the suite. Supports `--enable`, `--disable`, `--cron`.
- `obs suite secrets <id>` — update credentials/variables for an existing suite. Supports `--var KEY=VALUE` (repeatable) and `--var-file`.

## [1.7.0] - 2026-04-20

### Added
- `obs suite generate <url>` — generate a Playwright Autopilot test suite from a URL. Supports `--cron`, `--max-tests`, `--var KEY=VALUE`, `--var-file`, `--allow-form-submit`, and `-w/--wait` to stream generation progress.
- `obs suite list` — list all suites with status, test count, and schedule.
- `obs suite get <id>` — show full suite details including generated tests and variables.
- `obs suite run <id>` — trigger a suite execution. Supports `--wait` to stream results and `--tests` to run a subset.
- `obs suite status <id>` — show the latest execution status and results.
- `obs suite wait <id> <executionId>` — poll an execution until terminal state with a live spinner.
- `obs suite delete <id>` — delete a suite by ID.

### Fixed
- Suites created without `--cron` now default to `schedule_active=false` instead of showing "every 6h" inherited from the DB default.

## [1.6.0] - 2026-04-19

### Added
- `obs <resource> create --file <path>` — all resource create commands now accept a JSON file as payload, skipping interactive prompts. Works for monitor, check, heartbeat, alert-channel, status-page, incident, and ai-check.
- `obs validate -r <type> -f <path>` — offline schema validation against bundled schemas, no network call. Returns field-level errors on missing required fields. Supports `--json` output.
- `obs init <resource>` — extended `obs init` to scaffold a ready-to-edit JSON template for any resource type. Supports `--out <path>` with automatic directory creation.

### Internal
- `src/utils/schemas.ts` — bundled resource schemas (required fields + full templates) for all 7 resource types.
- E2e coverage: `file-workflow.test.ts` covers scaffold, validate (valid + invalid + missing file), and create --file with cleanup.

## [1.5.0] - 2026-04-19

### Added
- `obs ai-check status <execution-id>` to fetch the status of a persisted browser-check execution.
- `obs ai-check wait <execution-id>` to poll a persisted execution until terminal state, with optional `--timeout <ms>` and final results payload.

### Fixed
- `obs ai-check run --json` now emits a single strict JSON envelope on stdout with no SSE or spinner noise. `--reporter json` and `OBS_JSON_OUTPUT=true` route through the same path.

### Changed
- Visual refresh across CLI output. Emoji prefixes replaced with plain ASCII symbols and the brand palette is applied via a shared `theme.ts`.

### Internal
- E2E suite split into per-resource files with parallel runner. Full suite wall-clock dropped from ~813s to ~310s.

## [1.4.1] - 2026-03-16

### Fixed
- `obs login help` now shows command help instead of running login.

## [1.4.2] - 2026-03-16

### Fixed
- Update notice now suggests the correct package manager command (npm, pnpm, yarn, or bun).

## [1.4.3] - 2026-03-16

### Fixed
- `obs --version` now waits for the update check so the notice can render.

## [1.4.0] - 2026-03-16

### Added
- **Alert Channels**: New `obs alert-channel` CRUD commands.
- **Status Pages**: New `obs status-page` CRUD commands.
- **Incidents**: New `obs incident` CRUD commands.
- **E2E Coverage**: Lifecycle tests for alert channels, status pages, and incidents.

### Fixed
- **Resource Factory**: Allow resources without a `name` field.
- **Update Payloads**: Avoid sending null optional fields for status pages and incidents.

## [1.3.2] - 2026-03-16

### Fixed
- **Update Notice Box**: Dynamic sizing to prevent misaligned borders with longer version strings.
- **Command Option Parsing**: Normalize option resolution to ensure update/create/delete/toggle flags are read consistently.

## [1.3.1] - 2026-03-15

### Added
- **Config Transparency**: Added verbose logging (`-v`) to show exactly which source (Environment, Local Config, or Global Store) provided the API key.
- **Login Safety Check**: `obs login` now warns if an existing `OBS_API_KEY` in the environment will shadow the newly provisioned session.

### Fixed
- **Apply Delta Sync**: Corrected property mapping for URL monitors to ensure delta-optimization works as expected.
- **E2E Test Hardening**: Enhanced test runner with dynamic auth bootstrapping and environment isolation.

## [1.3.0] - 2026-03-15

### Added
- `obs logout` command to clear local authentication credentials.
- `--force` (`-f`) flag to `obs login` to bypass existing credentials and initiate a fresh authentication flow.

### Improved
- Standardized authentication flow to better handle pre-provisioned environment variables vs stored configuration.

## [1.2.1] - 2026-03-15

### Security Rollback
- **Removed**: `obs signup` command and the corresponding `/api/auth/agent/signup` backend endpoint have been removed to close a potential abuse vector for automated account creation. 

## [1.2.0] - 2026-03-15

### Added
- **Background Update Service**: CLI now automatically checks for new versions on npm and notifies the user (non-blocking, skipped in JSON mode).
- **ResourceCommandFactory**: Reified architecture for all resource commands, ensuring 100% consistent CRUD behavior.
- **Project-wide Strict Typing**: Removed all `any` types and achieved 100% TypeScript compliance.

### Fixed
- **Config Priority**: CLI now correctly honors local `.obs.config.json` files over global OS storage.
- **Resource Gaps**: Added missing `grace_period` and `description` fields to declarative sync (`obs apply`).
- **Error UX**: Standardized global error handling to ensure `JsonEnvelope` symmetry even on fatal crashes.
- **Lint Hardening**: Resolved 130+ lint warnings and hardened ESLint configuration.
