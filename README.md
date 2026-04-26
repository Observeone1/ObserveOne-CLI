# ObserveOne CLI

Artificial intelligence (AI)-powered website monitoring, synthetic testing, and infrastructure-as-code from your terminal.

The `obs` command-line interface (CLI) allows developers and artificial intelligence (AI) agents to manage URL Monitors, Application Programming Interface (API) Checks, Heartbeats, and AI Browser tests using simple commands or declarative JavaScript Object Notation (JSON) configuration files.

## Installation

```bash
npm install -g @observeone/cli
```

## Quick Start

1. **Login to ObserveOne**
   ```bash
   obs login
   ```

   *To switch accounts or refresh a session, use:* `obs login --force`

2. **Initialize Workspace**
   ```bash
   # Creates local .obs.config.json
   obs init
   ```

3. **Logout**
   ```bash
   # Clear local credentials
   obs logout
   ```

4. **Pull your existing configuration**
   ```bash
   obs export
   ```

4. **Manage a monitor**
   ```bash
   obs monitor create --name "My Website" --url "https://example.com" --interval "*/5 * * * *"
   obs monitor list
   ```

---

## Configuration Priority

The CLI resolves configuration settings in the following order (highest to lowest priority):

1.  **CLI Flags**: `--api-key`, `--api-url` passed directly to a command.
2.  **Environment Variables**: `OBS_API_KEY`, `OBS_API_URL`.
3.  **Local Config File**: `.obs.config.json` in the current working directory (created via `obs init`).
4.  **Global Store**: Global OS configuration (saved after `obs login`).
5.  **Defaults**: Internal default values.

---

## Config-as-Code (Declarative Workflow)

ObserveOne supports an Infrastructure-as-Code (IaC) workflow using JSON. You can define all your monitors, API checks, and heartbeats in a single `obs.json` file and sync them to your account.

### `obs export`
Fetch all your existing remote resources from the ObserveOne backend and save them locally.
```bash
# Generates obs.json in the current directory
obs export

# Save to a custom file
obs export -f my-stack.json
```

### `obs apply`
Sync your local JSON configuration to the ObserveOne backend. Only changed resources are updated — unchanged ones are skipped.
```bash
# Preview what would change (no writes)
obs apply --dry-run

# Sync obs.json
obs apply

# Sync a custom file
obs apply -f my-stack.json
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

**Example `obs.json` schema:**
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
> - `incidents` — included in export as a backup/audit artifact. `obs apply` warns and skips this block; incidents cannot be re-created from config.
> - `suites` — `obs apply` updates metadata for existing suites only. New suites require AI generation via `obs suite generate`.
> - Status-page attached monitors are exported but not applied. Manage them via `obs status-page add-monitor / remove-monitor`.

**Single-resource files (v1.13.0):** `obs apply` also accepts files holding a single resource, in three shapes:

```json
// Bare — type inferred from fields (url → monitor, url+method → check, period → heartbeat)
{ "name": "Landing", "url": "https://example.com", "interval": "*/5 * * * *" }
```
```json
// Wrapped — explicit resource key
{ "monitor": { "name": "Landing", "url": "https://example.com" } }
```
```json
// Explicit type — disambiguates the bare form
{ "type": "heartbeat", "name": "Daily Backup", "period": 86400 }
```

Useful for scripting one-off resources without maintaining a full `obs.json`.

---

## Resource Management (CRUD)

You can manually create, read, update, delete, and toggle individual resources directly from the terminal.

### URL Monitors
```bash
obs monitor create --name "Frontend" --url "https://example.com" --interval "*/5 * * * *" \
  --description "Production landing page" \
  --alert-channel-id 12 --alert-channel-id 47
obs monitor list
obs monitor list --search "Front" --status up --is-active true --limit 10 --page 1 --json
obs monitor get <id>
obs monitor update <id> --description "Updated copy" --alert-channel-id 47
obs monitor runs <id> --limit 10         # recent executions
obs monitor run <id>                      # trigger a manual run
obs monitor toggle <id>
obs monitor toggle-muted <id>
obs monitor delete <id> -y
```

Monitor flags:
- `-d, --description <text>` — optional description.
- `--alert-channel-id <id>` — attach an alert channel (repeat for multiple).
- `--no-alerts` — disable alerting on failure.

### API Checks
```bash
obs check create --name "Auth API" --url "https://api.example.com/auth" --method POST \
  --description "Signup endpoint" \
  --interval "*/5 * * * *" \
  --alert-channel-id 12 \
  --header "Authorization=Bearer test" --header "X-Trace=ci" \
  --assertion '{"type":"status_code","operator":"equals","value":"200"}' \
  --assertion '{"type":"json_path","operator":"equals","path":"$.ok","value":"true"}'
obs check list
obs check list --search "Auth" --status paused --is-active false --json
obs check update <id> --description "Signup v2" --header "X-Trace=ci-v2"
obs check runs <id> --limit 10            # recent executions
obs check run <id>                         # trigger a manual run
obs check toggle <id>
obs check toggle-muted <id>
obs check delete <id> -y
```

Check flags:
- `-d, --description <text>` — optional description.
- `-i, --interval <cron>` — schedule expression (e.g. `*/5 * * * *`).
- `--alert-channel-id <id>` — attach an alert channel (repeat for multiple).
- `--no-alerts` — disable alerting on failure.
- `--header KEY=VALUE` — HTTP header to send (repeatable).
- `--assertion <json>` — response assertion as a JSON object (repeatable). Supported types: `status_code`, `response_time`, `json_path` (uses `path`), `text_contains`, `header` (uses `path`). Operators: `equals`, `not_equals`, `greater_than`, `less_than`, `contains`, `not_contains`, `exists`, `regex_match`.

### Heartbeats (Cron Monitoring)
```bash
obs heartbeat create --name "Daily Backup" --period 86400 --grace 3600
obs heartbeat list
obs heartbeat list --search "Backup" --status late --limit 5 --json
obs heartbeat update <id> --period 43200
obs heartbeat runs <id> --limit 10        # recent pings
obs heartbeat toggle <id>
obs heartbeat toggle-muted <id>
obs heartbeat reset <id>                  # acknowledge missed pings and restart grace window
obs heartbeat delete <id> -y
```

List filtering notes:
- `--search` matches visible fields server-side.
- `--status` uses each resource's real status values.
- `--is-active true|false` filters by activation state separately from status.
- `--page` and `--limit` enable server-side pagination.

Run history (new in v1.13.0):
- `obs <resource> runs <id>` fetches recent executions/pings. Default limit 20, override with `-l, --limit`.

### Alert Channels
```bash
obs alert-channel create --name "Ops Email" --type email --email "ops@example.com"
obs alert-channel list
obs alert-channel get <id>
obs alert-channel update <id> --name "Ops Email Primary" --type email --email "ops@example.com"
obs alert-channel delete <id> -y
```

### Status Pages
```bash
obs status-page create --name "Public Status" --slug "public-status"
obs status-page list
obs status-page get <id>
obs status-page update <id> --description "Updated"
obs status-page delete <id> -y

# Attach / detach monitors from a status page
obs status-page add-monitor <sp-id> <resource-id> --type url-monitor --name "API" --order 1
obs status-page remove-monitor <sp-id> <resource-id>
```

### Incidents
```bash
obs incident create --title "API Outage" --priority HIGH --description "Initial investigation"
obs incident list
obs incident get <id>
obs incident update <id> --description "Resolved"
obs incident delete <id> -y

# Comment on an incident
obs incident comment <id> --message "Investigating upstream provider issue"

# Assign / unassign
obs incident assign <id> --user <user-id>
obs incident unassign <id>
```

### API Keys
```bash
obs api-key list
obs api-key create --name "CI Bot"
obs api-key revoke <id>        # also: obs api-key delete <id>
obs api-key toggle <id>
```

### Teams
```bash
obs team list
obs team members <team-id>
obs team invite <team-id>                           # regenerate invite code
obs team remove-member <team-id> <user-id>
obs team update-role <team-id> <user-id> --role member
```

---

## AI Browser Checks

Manage and execute intelligent Playwright-driven browser tests using natural language prompts.

```bash
# Run an existing test and output JUnit report for CI
obs ai-check run "Login Flow" --reporter junit

# Run multiple tests and output strict JSON for AI Agents
obs ai-check run test1 test2 --reporter json

# Run an ad-hoc test without saving it
obs ai-check run --adhoc --url https://example.com --prompt "Verify login section exists"
```

---

## Playwright Autopilot Suites

Generate and manage AI-driven Playwright test suites from your terminal.

```bash
# Generate a suite and tests (plans + generates all test scripts by default)
obs suite generate https://example.com --name "Smoke Tests" --max-tests 5

# Generate with a cron schedule
obs suite generate https://example.com --cron "0 */6 * * *"

# Plan only — review before generating tests
obs suite generate https://example.com --plan-only

# Pass credentials/variables to the test runner
obs suite generate https://example.com --var USERNAME=admin --var PASSWORD=secret
obs suite generate https://example.com --var-file .env.test

# List all suites
obs suite list

# Get full suite details
obs suite get <id>

# Trigger a run and stream results
obs suite run <id> --wait

# Check the latest execution status
obs suite status <id>

# Wait on a specific execution
obs suite wait <id> <executionId>

# Update schedule without regenerating (v1.8.0)
obs suite schedule <id> --enable
obs suite schedule <id> --disable
obs suite schedule <id> --cron "*/30 * * * *"

# Update credentials/variables without regenerating (v1.8.0)
obs suite secrets <id> --var USERNAME=admin --var PASSWORD=secret
obs suite secrets <id> --var-file .env.test

# Toggle public visibility of a suite
obs suite toggle-public <id>

# Trigger self-heal on a suite's failing tests
obs suite heal <id>

# Delete a suite
obs suite delete <id>
```

### CI Integration (v1.19.0)

Headless management of a suite's GitHub App / CI binding. Install + repo selection still happens in the web UI; these commands cover post-install ops that scripts and CI bootstraps actually need.

```bash
# Show current binding (provider, repo, branch, hooks, masked token)
obs suite ci status <id>

# Generate or rotate the inbound webhook token (each call invalidates the previous one)
obs suite ci webhook-token <id> -y

# Pipe the new token into a secret store
TOKEN=$(obs suite ci webhook-token <id> -y --json | jq -r '.data.token')

# Tear down the integration (invalidates the token, unbinds the repo)
obs suite ci disconnect <id> -y
```

The webhook token is what your CI pipeline `POST`s to `/webhook/playwright?token=<token>` to trigger a suite run. `status` shows it as `••••<last4>` for safety; `webhook-token` returns the full value.

---

## Resource Discovery (v1.9.0)

Enumerate resource templates and fetch their JSON schemas. All commands work offline against bundled schemas, no login required.

```bash
# List every resource type with required fields
obs templates list
obs templates list --json

# Print the JSON Schema (Draft-07) for any resource
obs schema monitor
obs schema ai-check
obs schema alert-channel --out ./schemas/alert-channel.schema.json

# Validate a JSON file against the bundled schema (offline)
obs validate --resource monitor --file ./my-monitor.json

# Scaffold a ready-to-edit template
obs init monitor
obs init ai-check --out ./tests/ai-check.json
```

Aliases: `api-check` → `check`, `url-monitor` → `monitor`, `browser-check` → `ai-check`.

The full chain for agents: `obs templates list` → `obs schema <name>` → generate payload → `obs validate` → `obs <resource> create --file <path>`. All steps except the final create are fully offline.

---

## AI Agent Integration (Headless Mode)

The `obs` CLI is explicitly designed to be used by AI coding agents.

### The `--json` Flag
Append `--json` to **any** command. The CLI will automatically suppress all human-readable output and return a strict, machine-readable `JsonEnvelope`.

**Guaranteed Agent Response Schema:**
```json
{
  "status": "SUCCESS",
  "data": { ... },
  "metadata": {
    "timestamp": "2026-03-11T12:00:00.000Z"
  }
}
```

For filtered list commands, the `data` payload is paginated:
```json
{
  "status": "SUCCESS",
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 0,
      "totalPages": 0
    }
  },
  "metadata": {
    "timestamp": "2026-04-22T12:00:00.000Z"
  }
}
```

### Headless Login
Agents can authenticate securely using existing credentials:
```bash
export OBS_EMAIL="agent@company.com"
export OBS_PASSWORD="secure-password"
obs login --headless
```

---

## Update Notifications

The CLI includes a non-blocking background update service that checks for newer versions on npm. If an update is available, a notification will be displayed at the start of your command output. This check is automatically disabled in `--json` mode.

---

## Global Options

- `-v, --verbose` - Enable verbose output and stack traces
- `--json` - Output in strict JSON format
- `--api-url <url>` - Override API URL
- `--api-key <key>` - Override API key
- `--version` - Show version number
- `--help` - Show help

## License
MIT

---
**Happy Testing!**
