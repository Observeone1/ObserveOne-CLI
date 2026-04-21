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
Sync your local JSON configuration to the ObserveOne backend. The CLI will automatically detect matching resources and perform surgical `create` and `update` API calls.
```bash
# Sync obs.json
obs apply

# Sync a custom file
obs apply -f my-stack.json
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
  ]
}
```

---

## Resource Management (CRUD)

You can manually create, read, update, delete, and toggle individual resources directly from the terminal.

### URL Monitors
```bash
obs monitor create --name "Frontend" --url "https://example.com" --interval "*/5 * * * *"
obs monitor list
obs monitor get <id>
obs monitor update <id> --name "Updated Frontend" --interval "*/10 * * * *"
obs monitor toggle <id>
obs monitor delete <id> -y
```

### API Checks
```bash
obs check create --name "Auth API" --url "https://api.example.com/auth" --method "POST"
obs check list
obs check update <id> --method "GET"
obs check toggle <id>
obs check delete <id> -y
```

### Heartbeats (Cron Monitoring)
```bash
obs heartbeat create --name "Daily Backup" --period 86400 --grace 3600
obs heartbeat list
obs heartbeat update <id> --period 43200
obs heartbeat toggle <id>
obs heartbeat delete <id> -y
```

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
```

### Incidents
```bash
obs incident create --title "API Outage" --priority HIGH --description "Initial investigation"
obs incident list
obs incident get <id>
obs incident update <id> --description "Resolved"
obs incident delete <id> -y
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

# Delete a suite
obs suite delete <id>
```

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
