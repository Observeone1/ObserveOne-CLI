# ObserveOne CLI

[![npm version](https://img.shields.io/npm/v/@observeone/cli.svg)](https://www.npmjs.com/package/@observeone/cli)
[![CI](https://github.com/Observeone1/ObserveOne-CLI/actions/workflows/ci.yml/badge.svg)](https://github.com/Observeone1/ObserveOne-CLI/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/node/v/@observeone/cli.svg)](package.json)

Website monitoring, synthetic testing, and infrastructure-as-code from your terminal.

The `obs` CLI lets developers and AI coding agents manage URL monitors, API checks, heartbeats, status pages, incidents, and Playwright Autopilot suites, either through individual commands or a single declarative JSON config.

## Installation

```bash
npm install -g @observeone/cli
```

## Quick Start

```bash
obs login        # Authenticate (use --force to switch accounts)
obs init         # Create a local .obs.config.json
obs export       # Pull your existing resources into obs.json
obs logout       # Clear local credentials
```

Create your first monitor:

```bash
obs url-monitor create --name "My Website" --url "https://example.com" --interval "*/5 * * * *"
obs url-monitor list
```

## Configuration Priority

The CLI resolves settings highest-to-lowest:

1. **CLI flags**: `--api-key`, `--api-url` passed to a command.
2. **Environment variables**: `OBS_API_KEY`, `OBS_API_URL`.
3. **Local config file**: `.obs.config.json` in the working directory (created by `obs init`).
4. **Global store**: OS-level config saved after `obs login`.
5. **Defaults**: built-in values.

## Config-as-Code (Declarative Workflow)

Define all your resources in one `obs.json` file and sync them to your account.

### `obs export`

Fetch your remote resources and save them locally.

```bash
obs export                      # Writes obs.json (suite scripts included)
obs export -f my-stack.json     # Custom file
obs export --no-scripts         # Omit suite Playwright scripts (lighter, config-only)
```

### `obs apply`

Sync local JSON to the backend. Only changed resources are updated; unchanged ones are skipped.

```bash
obs apply --dry-run             # Preview the diff, no writes
obs apply                       # Apply obs.json
obs apply -f my-stack.json      # Apply a custom file
```

`--dry-run` fetches remote state, runs the full diff, and prints a git-style preview:

```
~ monitor "Production API"
    - cron_expression: "*/5 * * * *"
    + cron_expression: "*/10 * * * *"

+ monitor "Staging DB"  (new)

  Monitors: 1 to create, 1 to update, 12 unchanged

  Run without --dry-run to apply.
```

**Example `obs.json`:**

```json
{
  "monitors": [
    {
      "name": "Production Website",
      "description": "Main landing page monitor",
      "url": "https://example.com",
      "interval": "*/5 * * * *",
      "alert_on_failure": true
    }
  ],
  "api_checks": [
    {
      "name": "Health API",
      "url": "https://api.example.com/health",
      "method": "GET"
    }
  ],
  "heartbeats": [
    {
      "name": "Database Backup Job",
      "period": 86400,
      "grace_period": 3600
    }
  ],
  "alert_channels": [
    {
      "name": "Slack Alerts",
      "type": "slack",
      "config": { "webhook_url": "https://hooks.slack.com/..." }
    }
  ],
  "status_pages": [
    {
      "slug": "status",
      "name": "System Status",
      "is_public": true,
      "show_incident_history": true,
      "show_uptime_percentage": true
    }
  ],
  "suites": [
    {
      "suite_name": "Smoke Tests",
      "target_url": "https://example.com",
      "cron_expression": "0 */6 * * *",
      "schedule_active": true
    }
  ],
  "incidents": [
    {
      "title": "API Degradation",
      "status": "OPEN",
      "priority": "HIGH"
    }
  ]
}
```

> **Notes:**
> - `incidents` are included in export as a backup artifact. `obs apply` warns and skips this block; incidents cannot be re-created from config.
> - `suites`: `obs apply` updates metadata for existing suites only. New suites require AI generation via `obs suite generate`.
> - Status-page attached monitors are exported but not applied. Manage them with `obs status-page add-monitor` / `remove-monitor`.

**Single-resource files:** `obs apply` also accepts a file holding one resource, in three shapes:

```jsonc
// Bare: type inferred from fields (url is monitor, url+method is check, period is heartbeat)
{ "name": "Landing", "url": "https://example.com", "interval": "*/5 * * * *" }
// Wrapped: explicit resource key
{ "monitor": { "name": "Landing", "url": "https://example.com" } }
// Explicit type: disambiguates the bare form
{ "type": "heartbeat", "name": "Daily Backup", "period": 86400 }
```

The bare form supports `monitor`, `check`, and `heartbeat`.

## Resource Management (CRUD)

Create, read, update, delete, and toggle individual resources from the terminal. Monitor, check, and heartbeat lists support server-side filtering with `--search`, `--status`, `--is-active true|false`, `--limit`, and `--page`. Pass `--file <path>` to `create` to supply a JSON payload instead of flags.

### URL Monitors

```bash
obs url-monitor create --name "Frontend" --url "https://example.com" --interval "*/5 * * * *" \
  --description "Production landing page" \
  --alert-channel-id 12 --alert-channel-id 47
obs url-monitor list --search "Front" --status up --is-active true --limit 10 --page 1
obs url-monitor get <id>
obs url-monitor update <id> --interval "*/10 * * * *"
obs url-monitor run <id>            # Trigger a manual check
obs url-monitor runs <id> --limit 10
obs url-monitor toggle <id>         # Pause or resume
obs url-monitor toggle-muted <id>   # Mute or unmute failure alerts
obs url-monitor delete <id> -y
```

Flags: `-d, --description`, `--alert-channel-id <id>` (repeatable), `--no-alerts` (disable failure alerting on create).

### API Checks

```bash
obs check create --name "Auth API" --url "https://api.example.com/auth" --method POST \
  --interval "*/5 * * * *" \
  --header "Authorization=Bearer test" --header "X-Trace=ci" \
  --status-code 200 --response-time-under 800
obs check list --search "Auth" --status paused --is-active false
obs check run <id>
obs check runs <id> --limit 10
obs check toggle <id>
obs check toggle-muted <id>
obs check delete <id> -y
```

Assertions can be raw JSON (`--assertion '{...}'`, repeatable) or shorthand flags (`--status-code`, `--status-code-not`, `--response-time-under/over`, `--json-path` / `--json-path-value`, `--text-contains`, `--header-exists`, `--regex-match`). See the [command reference](docs/reference/cli-commands.md#api-checks) for the full list.

### Heartbeats (Cron Monitoring)

```bash
obs heartbeat create --name "Daily Backup" --period 86400 --grace 3600
obs heartbeat list --search "Backup" --status late
obs heartbeat update <id> --period 43200
obs heartbeat runs <id> --limit 10
obs heartbeat reset <id>            # Acknowledge missed pings and restart the grace window
obs heartbeat toggle <id>
obs heartbeat toggle-muted <id>
obs heartbeat delete <id> -y
```

### Alert Channels

```bash
obs alert-channel create --name "Ops Email" --type email --email "ops@example.com"
obs alert-channel list
obs alert-channel test <id>         # Send a test notification through the channel
obs alert-channel update <id> --name "Ops Email Primary"
obs alert-channel delete <id> -y
```

Types: `email`, `slack`, `discord`, `teams`, `telegram`, `sms`, `webhook`.

### Status Pages

```bash
obs status-page create --name "Public Status" --slug "public-status"
obs status-page list
obs status-page update <id> --hide-uptime
obs status-page delete <id> -y

# Attach a monitor (returns an entry ID), reorder it, then detach it
obs status-page add-monitor <sp-id> <resource-id> --type url-monitor --name "API" --order 1
obs status-page reorder <sp-id> <entry-id> --order 2
obs status-page remove-monitor <sp-id> <entry-id>
```

`remove-monitor` and `reorder` take the entry ID returned by `add-monitor`, not the monitor's own ID.

### Incidents

```bash
obs incident create --title "API Outage" --priority HIGH --description "Initial investigation"
obs incident list
obs incident comment <id> --message "Investigating the upstream provider"
obs incident assign <id> --user <user-id>
obs incident unassign <id>

# Status verbs (status is OPEN, RESOLVED, or CLOSED)
obs incident resolve <id>
obs incident close <id>
obs incident reopen <id>
obs incident delete <id> -y
```

`create` and `update` also accept `--assigned-to <userId>` and `--team-id <teamId>`.

### API Keys

```bash
obs api-key list
obs api-key create --name "CI Bot"
obs api-key revoke <id> -y          # Also: obs api-key delete <id>
obs api-key toggle <id>
obs api-key rotate <id> -y          # New key with the same name, then revoke the old one
```

### Teams

```bash
obs team list
obs team members <team-id>
obs team invite <team-id>                          # Regenerate the invite code
obs team remove-member <team-id> <user-id> -y
obs team update-role <team-id> <user-id> --role member
```

## Playwright Autopilot Suites

Generate and manage AI-driven Playwright test suites from your terminal.

```bash
# Generate a suite (plans, then generates all test scripts by default)
obs suite generate https://example.com --name "Smoke Tests" --max-tests 5
obs suite generate https://example.com --cron "0 */6 * * *"
obs suite generate https://example.com --plan-only         # Review the plan before generating
obs suite generate https://example.com --var USER=admin --var PASS=secret
obs suite generate https://example.com --var USER --var PASS    # omit =value to enter secrets at a masked prompt
obs suite generate https://example.com --var-file .env.test

obs suite list
obs suite get <id>
obs suite run <id> --wait              # Trigger a run; --wait streams the result
obs suite status <id>                  # Latest execution status
obs suite wait <id> <executionId>      # Block on a specific execution
obs suite delete <id> -y

# Schedule and credentials without regenerating
obs suite schedule <id> --enable
obs suite schedule <id> --cron "*/30 * * * *"
obs suite secrets <id> --var-file .env.test

obs suite toggle-public <id> -y        # Confirms before exposing a suite; -y skips the prompt
obs suite heal <id>                    # Trigger self-heal on failing tests
```

### Edit Scripts Locally (pull / push)

Download a suite, edit its generated Playwright scripts, and push them back.

```bash
obs suite pull <id>                    # Writes ./suites/<slug>-<id>/
# ...edit the .spec.ts files...
obs suite push <id>                    # Sends your edits back
```

`pull` writes a folder per suite containing `PLAN.md` (when present), one `<test-name>.spec.ts` per test, and a `suite.json` manifest. `push` updates the test scripts only; plan edits are not sent back.

### CI Integration

Manage a suite's GitHub App / CI binding headlessly. Install and repo selection still happen in the web UI; these cover the post-install operations scripts need.

```bash
obs suite ci status <id>               # Show binding: repo, branch, hooks, masked token
obs suite ci webhook-token <id> -y     # Generate or rotate the inbound webhook token
obs suite ci disconnect <id> -y        # Remove the integration and invalidate the token

# Pipe a fresh token into a secret store
TOKEN=$(obs suite ci webhook-token <id> -y --json | jq -r '.data.token')
```

Each `webhook-token` call invalidates the previous one. Your CI pipeline POSTs the token to `/webhook/playwright?token=<token>` to trigger a run.

## Resource Discovery

Enumerate resource templates and fetch their JSON schemas. These work offline against bundled schemas, no login required.

```bash
obs templates list                     # Every resource type with required fields
obs schema monitor                     # Print the JSON Schema (Draft-07) for a type
obs schema alert-channel --out ./schemas/alert-channel.schema.json
obs validate --resource monitor --file ./my-monitor.json
obs init check --out ./tests/check.json   # Scaffold a ready-to-edit template
```

Resource-type aliases: `api-check` resolves to `check`, `url-monitor` to `monitor`. The full agent chain is `obs templates list` to `obs schema <name>` to a generated payload to `obs validate` to `obs <resource> create --file <path>`. Every step except the final create is offline.

## AI Agent Integration (Headless Mode)

The `obs` CLI is designed to be driven by AI coding agents.

### The `--json` Flag

Append `--json` to any command for a strict, machine-readable `JsonEnvelope`:

```json
{
  "status": "SUCCESS",
  "data": { },
  "metadata": { "timestamp": "2026-03-11T12:00:00.000Z" }
}
```

Filtered list commands return paginated data:

```json
{
  "status": "SUCCESS",
  "data": {
    "items": [],
    "pagination": { "page": 1, "limit": 10, "total": 0, "totalPages": 0 }
  },
  "metadata": { "timestamp": "2026-04-22T12:00:00.000Z" }
}
```

### Headless Login

Agents authenticate from environment variables:

```bash
export OBS_EMAIL="agent@company.com"
export OBS_PASSWORD="secure-password"
obs login --headless
```

## Global Options

- `-v, --verbose`: verbose output and stack traces
- `--json`: strict JSON output
- `--api-url <url>`: override the API URL
- `--api-key <key>`: override the API key
- `--version`: show the version number
- `--help`: show help

The CLI also runs a non-blocking background check for newer versions on npm and prints a notice if one is available. This is disabled in `--json` mode.

## Documentation

Deeper docs live in [`docs/`](docs/):

- **Guides**
  - [Getting started](docs/guides/getting-started.md): install, login, headless agent auth
  - [Config-as-code](docs/guides/config-as-code.md): the `obs apply` / `obs export` workflow
  - [AI agent integration](docs/guides/ai-agent-integration.md): JSON envelope, agent recipes
- **Reference**
  - [CLI command reference](docs/reference/cli-commands.md): every command and flag
  - [Environment variables](docs/reference/environment-variables.md)
  - [JSON schema](docs/reference/json-schema.md)
- **Architecture** (for contributors)
  - [Implementation summary](docs/architecture/implementation-summary.md)
  - [E2E testing framework](docs/architecture/e2e-testing.md)

## Contributing

Contributions are welcome. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for dev setup, test commands, and the PR workflow.

## License

Released under the [Apache License 2.0](LICENSE).
