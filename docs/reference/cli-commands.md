---
title: CLI Commands
description: Exhaustive list of all manual CRUD and operational commands
---

# CLI Commands

The `obs` command-line interface (CLI) provides comprehensive manual create, read, update, delete (CRUD) resource management.

## Authentication
Manage CLI sessions and account provisioning.
```bash
obs login                # Interactive OAuth-based authentication
obs login --force        # Force a new login session (bypass existing credentials)
obs login --headless     # Use pre-provisioned OBS_EMAIL/OBS_PASSWORD to authenticate
obs logout               # Clear local authentication credentials
```

## Project Initialization
Initialize local project configuration, or scaffold a resource template.
```bash
obs init                          # Create obs.json in the current directory
obs init monitor                  # Scaffold obs-monitor.json template
obs init ai-check --out ./tests/ai-check.json
```

## Resource Discovery
Enumerate resource templates and fetch their JSON schemas (offline, no API call).
```bash
obs templates list                # List all 7 resource types with required fields
obs templates list --json
obs schema monitor                # Print JSON Schema (Draft-07) for a resource
obs schema alert-channel --out ./schemas/alert-channel.schema.json
obs validate -r monitor -f ./my-monitor.json   # Offline schema validation
```
Aliases: `api-check` → `check`, `url-monitor` → `monitor`, `browser-check` → `ai-check`.

## Monitors
Manage basic HTTP ping monitors.
```bash
obs monitor create --name "Frontend" --url "https://example.com" --interval "*/5 * * * *"
obs monitor list
obs monitor get <id>
obs monitor update <id> --name "Updated Frontend" --interval "*/10 * * * *"
obs monitor toggle <id>
obs monitor delete <id> -y
```

## API Checks
Manage complex Application Programming Interface (API) health checks.
```bash
obs check create --name "Auth API" --url "https://api.example.com/auth" --method "POST"
obs check list
obs check get <id>
obs check update <id> --method "GET"
obs check toggle <id>
obs check delete <id> -y
```

## Heartbeats
Manage heartbeat checks (for monitoring background jobs or cron tasks).
```bash
obs heartbeat create --name "Daily Backup" --period 86400 --grace 3600
obs heartbeat list
obs heartbeat get <id>
obs heartbeat update <id> --period 43200
obs heartbeat toggle <id>
obs heartbeat delete <id> -y
```

## Alert Channels
Manage alert channels for notifications.
```bash
obs alert-channel create --name "Ops Email" --type email --email "ops@example.com"
obs alert-channel list
obs alert-channel get <id>
obs alert-channel update <id> --name "Ops Email Primary" --type email --email "ops@example.com"
obs alert-channel delete <id> -y
```

## Status Pages
Manage public or private status pages.
```bash
obs status-page create --name "Public Status" --slug "public-status"
obs status-page list
obs status-page get <id>
obs status-page update <id> --description "Updated"
obs status-page delete <id> -y
```

## Incidents
Manage incidents.
```bash
obs incident create --title "API Outage" --priority HIGH --description "Initial investigation"
obs incident list
obs incident get <id>
obs incident update <id> --description "Resolved"
obs incident delete <id> -y
```

## AI Browser Checks
Manage and execute intelligent Playwright-driven browser tests.
```bash
obs ai-check create --name "Login Flow" --url "https://app.com" --prompt "Login with test@example.com"
obs ai-check list
obs ai-check get <id>
obs ai-check delete <id> -y
```

### Running AI Checks
You can execute pre-configured checks or run them "ad-hoc" on the fly.
```bash
# Run an existing test by name or ID
obs ai-check run "Login Flow"
obs ai-check run 123

# Run multiple tests sequentially
obs ai-check run test1 test2 test3

# Run an ad-hoc test without saving it to the database
obs ai-check run --adhoc --url https://example.com --prompt "Verify the hero section exists"

# JSON output (immediate unless --wait is set)
obs ai-check run "Login Flow" --json
obs ai-check run "Login Flow" --json --wait

# Reporters
obs ai-check run "Login Flow" --reporter json
obs ai-check run "Login Flow" --reporter junit --output results.xml
```

### Tracking Async Executions
For saved checks, `obs ai-check run` returns an `execution_id`. Use `status` and `wait` to track it without blocking your pipeline.
```bash
obs ai-check status <execution-id>
obs ai-check wait <execution-id>
obs ai-check wait <execution-id> --timeout 120000
obs ai-check status <execution-id> --json
obs ai-check wait <execution-id> --json
```

### Reporter Options
Use `--reporter` to control the output format of `obs ai-check run`.

| Reporter | Output | Use case |
|----------|--------|----------|
| `console` | Human-readable terminal output | Default. Local development and debugging. |
| `json` | Single strict JSON envelope on stdout | AI agent pipelines and scripting. |
| `junit` | JUnit XML report | CI/CD systems (GitHub Actions, Jenkins, CircleCI). |

```bash
obs ai-check run "Login Flow" --reporter console   # default
obs ai-check run "Login Flow" --reporter json
obs ai-check run "Login Flow" --reporter junit > results.xml
```

## Playwright Autopilot Suites
Generate and manage AI-driven Playwright test suites from a URL.

```bash
# Generate a suite (manual trigger, no schedule)
obs suite generate https://example.com --name "Smoke Tests" --max-tests 5

# Generate with a cron schedule and wait for generation to complete
obs suite generate https://example.com --cron "0 */6 * * *" --wait

# Pass credentials/variables to the test runner
obs suite generate https://example.com --var USERNAME=admin --var PASSWORD=secret
obs suite generate https://example.com --var-file .env.test

# List all suites
obs suite list

# Get full suite details (tests, variables, schedule)
obs suite get <id>

# Trigger a run
obs suite run <id>

# Trigger a run and stream results
obs suite run <id> --wait

# Check the latest execution status
obs suite status <id>

# Wait on a specific execution
obs suite wait <id> <executionId>

# Delete a suite
obs suite delete <id>
```

## Config-as-Code
Manage your infrastructure declaratively.
```bash
obs export                  # Export all remote resources to obs.json
obs export --include-scripts # Inline suite Playwright scripts under suites[].tests
obs apply                   # Synchronize local obs.json with the backend
obs apply -f custom.json    # Use a specific configuration file
```
