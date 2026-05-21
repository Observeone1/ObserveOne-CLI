# Changelog

All notable changes to the ObserveOne CLI project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.26.0] - 2026-05-21

### Changed
- **`obs export` now emits `ping_key` and `alert_on_failure` on each heartbeat.** The self-hosted oo-workers import (v1.22.0+) re-uses `ping_key` as the heartbeat token, which preserves the public ping URL across migration. Without it, every service still POSTing to the old `/heartbeat/:token` URL would silently stop being recorded after the cut-over.

## [1.25.0] - 2026-05-19

### Changed
- **`obs export` is now lossless by default.** Suite Playwright scripts are included automatically — no flag required. Pass `--no-scripts` for a lighter, config-only export. The previous `--include-scripts` flag is still accepted but is now a no-op (deprecated; kept for CI back-compat).
- **`obs export` now emits a bundle-local `id`** on each `monitors[]`, `api_checks[]`, and `alert_channels[]` entry. This is a surrogate key local to the export file: it lets cross-references resolve on import — monitors/api_checks `channel_ids` → the exported alert channel, and `status_pages[].monitors[].monitor_id` → the exported monitor/api_check. All other DB-owned fields (`created_at`, `user_id`, …) are still stripped. `obs apply` strips this `id` before sending to the backend, so round-trips (export → apply) are unaffected.

### Notes
- The `id` is not a real identifier in any target instance — importers (e.g. self-hosted oo-workers) use it only to wire up relationships within the bundle, then assign their own ids. This unblocks faithful migration of monitor→channel bindings and status-page monitor attachments.

## [1.24.0] - 2026-05-19

### Added
- `obs incident resolve|close|reopen <id>` — set an incident's status to RESOLVED / CLOSED / OPEN. Previously blocked by a backend bug; enabled by Backend-Express PR #109 (partial incident update schema).
- `obs status-page reorder <sp-id> <entry-id> --order <n>` — change a monitor's display order on a status page. Previously had no backend route; enabled by Backend-Express PR #109 (`PATCH /status-pages/:id/monitors/:id`).

### Notes
- Both commands require a backend running PR #109 or later. Closes the CLI parity track (the two items deferred from v1.23.0).

## [1.23.0] - 2026-05-19

### Added
- `obs api-key rotate <id>` — create a replacement key with the same name, then revoke the old one (create-before-revoke; prints the new key once).
- `obs suite generate-test|dismiss-planned|restore-planned <suite-id> --planned-file <f>` and `obs suite heal-history <test-id> --heal-id <id>` — planned-file and heal-history operations previously only available in the web UI.

### Notes
- A fresh CLI↔frontend parity audit closed the parity track. Two audited gaps were intentionally not shipped: status-page monitor reorder (the frontend calls a backend route that does not exist) and incident state verbs (CLI vs backend incident-status enum mismatch) — both filed as separate findings.

## [1.22.1] - 2026-05-19

### Changed
- Relicensed from MIT to the Apache License 2.0 for consistency with the rest of the ObserveOne stack and to add an explicit patent grant. All copyright is held by ObserveOne (no external contributors), so the relicense is clean. The top-level `LICENSE` file now contains the full Apache 2.0 text. The bundled `examples/` package was relicensed to match.

### Removed
- `test-upload.txt` — a leftover Railway upload-test stub, not needed in the public repo.

## [1.22.0] - 2026-05-14

### Changed
- Resource-command factory now reads a schema-driven default for `createPrompts` / `updatePrompts` when a command doesn't provide its own. Six commands (`monitor`, `check`, `heartbeat`, `alert-channel`, `incident`, `status-page`) had nearly-identical hand-rolled prompt blocks that duplicated logic across 12 places; the new model lives in `src/utils/schemas.ts` (`FieldSchema` metadata: inquirer type, label, required-on-create, choices, validate, transformer, default, treatEmptyArrayAsAbsent) and `src/utils/schema-prompts.ts` (builders that the factory falls back to). Net ~500 lines deleted across the per-command files, ~300 added in the shared infrastructure.
- Internal refactor only — every interactive flow, validator, transformer, and payload shape is preserved. `obs check`, `obs alert-channel` keep their slim custom composers (assertions, type-dependent config) on top of the schema-driven default.

### Fixed
- `obs check create` previously re-prompted for HTTP method even when the user passed `--method GET` (due to a stale `when: !method || method === 'GET'` clause). Now it accepts the passed value directly.
- `obs check update` had a typo (`cron_sequence` instead of `cron_expression`) that silently dropped any interval update. The migration to schema-driven defaults removes the typo.
- `obs incident create --priority foo` now errors with a clear "Invalid priority: 'FOO'. Must be one of: CRITICAL, HIGH, MEDIUM, LOW" before contacting the backend, instead of the prior "Priority is required" misleading message. Same for any list-type field in any command.

### Notes
- 14 new unit tests in `src/__tests__/utils/schema-prompts.test.ts` cover trigger logic, transformer application, flag↔API field mapping (e.g. heartbeat `--grace` → `grace_period`), default merging, update fallback semantics, and cross-resource schema consistency.
- Full e2e suite (124 tests) passes against the local backend.

## [1.21.0] - 2026-05-12

### Added
- `obs export --include-scripts` — inline each suite's generated Playwright scripts under `suites[].tests[]` (`{ name, script }`). Default export remains metadata-only. Enables self-host migrations, offline backups, and portable archives via one command instead of per-suite `obs suite pull`.

## [1.20.0] - 2026-05-11

### Added
- Open-sourced under the MIT license.
- Top-level `LICENSE` file (MIT).
- `CONTRIBUTING.md` covering dev setup, test commands, quality gates, and PR workflow.

### Changed
- `README.md` — added badges, fixed Quick Start numbering, added Documentation and Contributing sections linking into `docs/`.
- `docs/architecture/implementation-summary.md` — reframed for contributors; tightened phrasing.
- `package.json` — added `repository`, `homepage`, `bugs` fields for npm metadata; removed stale `start`/`start:dev` scripts.

### Fixed
- `e2e/tests/export.test.ts` `testDeclarativeExportExtendedCoverage` — replaced stale `--config <json>` flag with `--webhook-url`, removed unsupported `--public` flag on `status-page create`.

## [1.19.1] - 2026-04-26

### Fixed
- `obs suite ci status/webhook-token/disconnect` — error catch blocks were calling `formatJsonOutput({ status: 'ERROR', ... })` instead of `outputService.error(msg)`, producing a malformed nested envelope `{ status: "SUCCESS", data: { status: "ERROR" } }` instead of the correct top-level `{ status: "ERROR" }` shape. All three CI commands fixed.

## [1.19.0] - 2026-04-26

### Added
- `obs suite ci status <id>` — show the CI integration for a suite (provider, repo, branch, hooks, masked webhook token, last-fired timestamp). Returns `null` envelope when the suite has no integration.
- `obs suite ci webhook-token <id>` — generate (rotate) the inbound webhook token for a suite. Each call invalidates the previous token. Requires `-y/--yes` to skip the rotation confirmation; same TTY guard as other destructive commands.
- `obs suite ci disconnect <id>` — remove the CI integration for a suite. Invalidates the webhook token and unbinds the repo. Same TTY guard as other delete-style commands.

### Notes
- Install / repo selection / branch picking still happens in the web UI — those flows require GitHub App OAuth which doesn't fit a headless CLI. These three subcommands cover the post-install ops that headless agents (CI bootstrap, Terraform/Pulumi pipelines, secret rotation) actually need.
- The `status` command shows the webhook token as `••••<last4>`. Use `webhook-token` to get (and rotate) the full value.
- 5 new e2e tests in `e2e/tests/suite/ci.test.ts` (help, TTY guards, error envelope on invalid suite).

## [1.18.2] - 2026-04-26

### Fixed
- `--help` grammar: vowel-starting resource names now use "an" (e.g. "Get details of an alert-channel", "Delete an incident") instead of the ungrammatical "a alert-channel" / "a incident".

## [1.18.1] - 2026-04-26

### Fixed
- `obs suite delete <id>` now requires `-y/--yes` confirmation and fails fast in non-TTY contexts without it (was silently deleting with no guard).
- `obs ai-check list -f json` renamed to `-o, --output json` to match the rest of the CLI (`-f` is reserved for `--file`).
- `obs ai-check get <id> --json` now correctly uses JSON output when passed as a flag (was only checking `OBS_JSON_OUTPUT` env var).

## [1.18.0] - 2026-04-26

### Added
- `--help` now shows usage examples for `monitor create/update`, `check create/update`, `heartbeat create`, `apply`, `export`, and `suite generate`.
- `obs api-key delete <id>` now works as an alias for `obs api-key revoke <id>`.

### Fixed
- `obs suite run --json --wait` — spinner ANSI escape codes no longer corrupt JSON output when stdout is a TTY.
- All `delete`-style commands (`monitor`, `check`, `heartbeat`, `alert-channel`, `status-page`, `incident`, `team remove-member`, `api-key revoke`) now fail fast with exit code 1 in non-interactive (non-TTY or `--json`) contexts when `--yes` is missing, instead of hanging on stdin.
- Interactive `create` prompts (`monitor create`, `check create`, `heartbeat create`) now fail fast in non-TTY contexts with a clear message directing users to pass required flags.
- `obs apply --help` description updated to reflect all 7 supported resource types.

### Breaking changes
- `-f, --format` short flag on all list commands renamed to `-o, --output`. Use `obs monitor list -o json` instead of `obs monitor list -f json`.
- `-f, --force` short flag on `obs login` removed. Use `obs login --force`.

## [1.17.0] - 2026-04-26

### Added
- `obs export` now captures all 7 resource types: monitors, API checks, heartbeats, alert channels, status pages, incidents, and suites. Previously only monitors, checks, and heartbeats were exported. Status pages are detail-hydrated to include attached monitors. All new types strip DB-owned fields (`id`, `created_at`, `updated_at`) on export.
- `obs apply` now upserts alert channels (identity: `name`), status pages (identity: `slug`), and suites (identity: `suite_name`). Incidents in the config emit a warning and are skipped — they are runtime state and cannot be re-created from config.
- `testDeclarativeExportExtendedCoverage` e2e test — creates alert channel + status page + incident, runs export, asserts all new top-level keys are present and DB fields are stripped, then cleans up.
- `testAlertChannelTestSucceeds` e2e test — happy-path coverage for `obs alert-channel test`. Previously only failure paths were covered.
- 8 new unit tests for `normalizeApplyConfig` covering all new resource types and mixed configs.

### Fixed
- `obs suite heal --json` returned the raw backend response instead of a typed envelope. Now returns `{ heals: [...] }` consistent with all other suite commands.
- `obs status-page add-monitor --json` returned the raw entry object. Now returns `{ status_page_monitor: { ... } }`.
- `obs status-page remove-monitor --json` returned `{ status: 'ok', status_page_id, monitor_id }`. Now returns `{ status_page_monitor: { status_page_id, monitor_id, deleted: true } }`.
- `obs incident unassign` — added an inline comment clarifying that `null` assignee is the unassign mechanism (no dedicated backend route exists).

### Notes
- **Suite apply**: `obs apply` updates suite metadata (name, target URL) for existing suites. New suites cannot be created via apply — they require AI generation via `obs suite generate`. Apply will warn and skip any suite not already present.
- **Status-page monitors**: attached monitors are exported but not applied. Manage them via `obs status-page add-monitor / remove-monitor`.
- **Incidents**: included in export as a backup/audit artifact. Apply warns and skips any `incidents` block.

### Breaking changes (JSON output shape)
- `obs suite heal --json`: `data` key was `{ suite_id, heals }`, now `{ heals }`.
- `obs status-page add-monitor --json`: was raw entry, now `{ status_page_monitor: { ... } }`.
- `obs status-page remove-monitor --json`: was `{ status: 'ok', status_page_id, monitor_id }`, now `{ status_page_monitor: { status_page_id, monitor_id, deleted: true } }`.

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
