---
title: CLI Commands
description: Full reference for every obs command, subcommand, and flag
---

# CLI Commands

This is the exhaustive reference for the `obs` CLI. Every command, subcommand, and notable flag is listed here. The [README](../../README.md) keeps a shorter, curated set of the commands you reach for daily.

Append `--json` to any command for a strict machine-readable envelope. Run `obs <command> --help` to see the live flag list for any command.

## Global options

Available on every command:

| Flag | Purpose |
|------|---------|
| `-v, --verbose` | Verbose output and stack traces |
| `--json` | Strict JSON output (suppresses human formatting) |
| `--api-url <url>` | Override the API URL |
| `--api-key <key>` | Override the API key |
| `-V, --version` | Print the version |
| `-h, --help` | Show help |

## Authentication

```bash
obs login                # Interactive browser-based authentication
obs login --force        # Start a fresh session, ignoring stored credentials
obs login --api-key <k>  # Authenticate with an API key
obs login --headless     # Authenticate from OBS_EMAIL / OBS_PASSWORD (agents, CI)
obs login --skip-setup   # Skip the project-config prompts after login
obs logout               # Clear local credentials
```

## Project setup and resource discovery

`init`, `schema`, `validate`, and `templates` all work offline against bundled schemas. No login required. They cover the core resource types (`monitor`, `check`, `heartbeat`, `alert-channel`, `status-page`, `incident`); run `obs templates list` for the authoritative set. Resource-name aliases: `api-check` resolves to `check`, `url-monitor` to `monitor`.

```bash
obs init                                   # Create .obs.config.json in the current directory
obs init monitor                           # Scaffold obs-monitor.json from the template
obs init check --out ./tests/check.json    # Scaffold to a custom path

obs templates list                         # List every resource type with required fields
obs templates list --json

obs schema monitor                         # Print the JSON Schema (Draft-07) for a type
obs schema alert-channel --out ./schemas/alert-channel.schema.json

obs validate -r monitor -f ./my-monitor.json   # Validate a file against the bundled schema
```

The full offline chain for agents: `obs templates list` then `obs schema <name>` then build a payload then `obs validate` then `obs <resource> create --file <path>`.

## Common resource patterns

`monitor`, `check`, `heartbeat`, `alert-channel`, `status-page`, and `incident` share a generated command set:

```bash
obs <resource> list [filters]      # List (most types support server-side filters, see below)
obs <resource> get <id>            # Show one resource
obs <resource> create [flags]      # Create (or: create --file <path>)
obs <resource> update <id> [flags] # Update
obs <resource> delete <id> -y      # Delete (-y skips the confirmation prompt)
obs <resource> toggle <id>         # Pause or resume (monitor, check, heartbeat)
```

List filters (monitor, check, heartbeat):

| Flag | Purpose |
|------|---------|
| `-s, --search <query>` | Filter by search text |
| `-S, --status <status>` | Filter by status |
| `--is-active <true\|false>` | Filter by active lifecycle state |
| `-l, --limit <n>` | Max results per page |
| `-p, --page <n>` | Page number (1-based) |

## URL monitors

`obs url-monitor` (alias: `obs monitor`).

```bash
obs url-monitor create --name "Frontend" --url "https://example.com" --interval "*/5 * * * *" \
  --description "Production landing page" \
  --alert-channel-id 12 --alert-channel-id 47
obs url-monitor list --search "Front" --status up --is-active true --limit 10 --page 1 --json
obs url-monitor update <id> --interval "*/10 * * * *"
obs url-monitor run <id>            # Trigger a manual check
obs url-monitor runs <id> -l 10     # Recent executions (default limit 20)
obs url-monitor toggle <id>         # Pause or resume
obs url-monitor toggle-muted <id>   # Mute or unmute failure alerts
obs url-monitor delete <id> -y
```

Create/update flags: `-n, --name`, `-d, --description`, `-u, --url`, `-i, --interval` (cron), `--alert-channel-id <id>` (repeatable), `--no-alerts` (create only, disables failure alerting).

## API checks

`obs check`. Same CRUD, plus `run`, `runs`, `toggle`, `toggle-muted`.

```bash
obs check create --name "Auth API" --url "https://api.example.com/auth" --method POST \
  --interval "*/5 * * * *" --header "Authorization=Bearer test" \
  --status-code 200 --response-time-under 800
obs check run <id>
obs check runs <id> -l 10
obs check delete <id> -y
```

Request flags: `-n, --name`, `-d, --description`, `-u, --url`, `-m, --method`, `-i, --interval`, `--header <KEY=VALUE>` (repeatable), `--body <text>`, `--regions <region>` (repeatable), `--retry-count <n>`, `--retry-interval <ms>`, `--alert-channel-id <id>` (repeatable), `--no-alerts`.

Assertions can be passed as raw JSON or via shorthand flags:

| Flag | Builds |
|------|--------|
| `--assertion <json>` (repeatable) | Raw assertion object |
| `--assertion-file <path>` | JSON array of assertions |
| `--status-code <v>` / `--status-code-not <v>` | Status code equals / not-equals |
| `--response-time-under <ms>` / `--response-time-over <ms>` | Response-time less-than / greater-than |
| `--json-path <path>` [`--json-path-value <v>`] | JSON path exists, or equals a value |
| `--text-contains <t>` / `--text-not-contains <t>` | Body contains / does not contain |
| `--header-exists <name>` | Response header exists |
| `--regex-match <pattern>` | Body matches a regex |

Assertion types: `status_code`, `response_time`, `json_path`, `text_contains`, `header`. Operators: `equals`, `not_equals`, `greater_than`, `less_than`, `contains`, `not_contains`, `exists`, `regex_match`.

## Heartbeats

`obs heartbeat`. Same CRUD, plus `runs`, `toggle`, `toggle-muted`, and `reset`.

```bash
obs heartbeat create --name "Daily Backup" --period 86400 --grace 3600
obs heartbeat update <id> --period 43200
obs heartbeat runs <id> -l 10       # Recent pings
obs heartbeat reset <id>            # Acknowledge missed pings and restart the grace window
obs heartbeat toggle <id>
obs heartbeat toggle-muted <id>
obs heartbeat delete <id> -y
```

Create/update flags: `-n, --name`, `-d, --description`, `-p, --period <seconds>`, `-g, --grace <seconds>`.

## Alert channels

`obs alert-channel`. CRUD plus `test`.

```bash
obs alert-channel create --name "Ops Email" --type email --email "ops@example.com"
obs alert-channel create --name "Slack" --type slack --webhook-url "https://hooks.slack.com/..."
obs alert-channel test <id>         # Send a test notification through the channel
obs alert-channel delete <id> -y
```

Flags: `-n, --name`, `-t, --type` (`email`, `slack`, `discord`, `teams`, `telegram`, `sms`, `webhook`), `--email`, `--webhook-url`, `--bot-token`, `--chat-id`, `--account-sid`, `--auth-token`, `--from-number`, `--phone-number`, `--default`.

## Status pages

`obs status-page`. CRUD plus monitor attachment commands.

```bash
obs status-page create --name "Public Status" --slug "public-status"
obs status-page update <id> --theme-primary-color "#0ea5e9" --hide-uptime

# Attach a monitor (returns an entry ID), reorder it, then detach it
obs status-page add-monitor <sp-id> <resource-id> --type url-monitor --name "API" --order 1
obs status-page reorder <sp-id> <entry-id> --order 2
obs status-page remove-monitor <sp-id> <entry-id>
obs status-page delete <id> -y
```

`add-monitor` and `remove-monitor`/`reorder` use different second arguments: `add-monitor` takes the resource ID, while `remove-monitor` and `reorder` take the entry ID returned by `add-monitor`. Monitor types: `url-monitor`, `api-check`, `heartbeat`.

Create/update flags: `--slug`, `-n, --name`, `-d, --description`, `--logo-url`, `--theme-primary-color`, `--theme-background-color`, `--private`, `--hide-incident-history`, `--hide-uptime`.

## Incidents

`obs incident`. CRUD plus comments, assignment, and status verbs.

```bash
obs incident create --title "API Outage" --priority HIGH --description "Initial investigation" \
  --assigned-to <user-id> --team-id <team-id>
obs incident comment <id> --message "Investigating the upstream provider"
obs incident assign <id> --user <user-id>
obs incident unassign <id>

# Status verbs (status is OPEN, RESOLVED, or CLOSED)
obs incident resolve <id>
obs incident close <id>
obs incident reopen <id>
obs incident delete <id> -y
```

Create/update flags: `-t, --title`, `-p, --priority` (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`), `-d, --description`, `--assigned-to <userId>`, `--team-id <teamId>`.

## Playwright Autopilot suites

`obs suite`. Suites are AI-generated Playwright test suites. New suites can only be created with `generate`; `apply` updates metadata on existing suites but cannot create them.

```bash
# Generate (plans, then generates all test scripts by default)
obs suite generate https://example.com --name "Smoke Tests" --max-tests 5
obs suite generate https://example.com --cron "0 */6 * * *"
obs suite generate https://example.com --plan-only         # Stop after planning
obs suite generate https://example.com --var USER=admin --var PASS=secret
obs suite generate https://example.com --var-file .env.test
obs suite generate https://example.com --allow-form-submit  # Let agents submit non-auth forms

obs suite list
obs suite get <id>
obs suite run <id> --wait                  # Trigger a run; --wait blocks for the result
obs suite run <id> --tests <id1,id2>       # Run a subset of tests
obs suite status <id> [executionId]        # Status of an execution (defaults to latest)
obs suite wait <id> <executionId>          # Block until an execution finishes (CI-friendly)
obs suite update <id> --name "New name" --url "https://new.example.com"
obs suite delete <id> -y
obs suite toggle-public <id> -y            # Confirms before exposing a suite; -y skips the prompt
obs suite heal <id>                        # Trigger self-heal on failing tests
obs suite heal-history <test-id> --heal-id <id>

# Schedule and secrets (no regeneration)
obs suite schedule <id> --enable
obs suite schedule <id> --disable
obs suite schedule <id> --cron "*/30 * * * *"
obs suite secrets <id> --var USER=admin --var PASS=secret
obs suite secrets <id> --var-file .env.test

# Planned-file lifecycle
obs suite generate-test <suite-id> --planned-file <file>
obs suite dismiss-planned <suite-id> --planned-file <file>
obs suite restore-planned <suite-id> --planned-file <file>
```

`generate` flags: `--name`, `--cron`, `--max-tests <n>` (1-30, default 10), `--var <KEY[=VALUE]>` (repeatable; omit `=VALUE` to enter the secret at a masked prompt instead of leaking it into shell history), `--var-file <path>`, `--allow-form-submit`, `--plan-only`. (`-w, --wait` on `generate` is deprecated and has no effect; generation is now the default.)

### Edit scripts locally: pull and push

`pull` downloads a suite to disk so you can edit the generated Playwright scripts and `push` them back.

```bash
obs suite pull <id>                    # Writes ./suites/<slug>-<id>/
obs suite pull <id> --out ./my-suites  # Custom base directory
# ...edit the .spec.ts files...
obs suite push <id>                    # Reads from ./suites by default
obs suite push <id> --from ./my-suites
```

`pull` writes a folder per suite containing `PLAN.md` (when the suite has one), one `<test-name>.spec.ts` per test, and a `suite.json` manifest. `push` locates the folder by the suite ID in `suite.json` and updates each test script. `push` updates test scripts only: edits to `PLAN.md` are not sent back, and neither the CLI nor the dashboard edits the plan today.

### CI integration

Headless management of a suite's GitHub App / CI binding. Install and repo selection still happen in the web UI; these cover the post-install operations scripts need.

```bash
obs suite ci status <id>                # Show binding: repo, branch, hooks, masked token
obs suite ci webhook-token <id> -y      # Generate or rotate the inbound webhook token
obs suite ci disconnect <id> -y         # Remove the integration and invalidate the token

# Pipe a fresh token into a secret store
TOKEN=$(obs suite ci webhook-token <id> -y --json | jq -r '.data.token')
```

Each `webhook-token` call invalidates the previous token. `status` masks it as `••••<last4>`; `webhook-token` returns the full value. Your CI pipeline POSTs the token to `/webhook/playwright?token=<token>` to trigger a run.

## API keys

```bash
obs api-key list
obs api-key create --name "CI Bot"
obs api-key revoke <id> -y      # Also works as: obs api-key delete <id>
obs api-key toggle <id>         # Activate or deactivate
obs api-key rotate <id> -y      # Create a replacement with the same name, then revoke the old key
```

`rotate` creates the new key before revoking the old one, so there is never a window without a working key. If the old key fails to revoke, the new key still works and the command tells you to revoke the old one manually.

## Teams

```bash
obs team list
obs team members <team-id>
obs team invite <team-id>                          # Regenerate and print the invite code
obs team remove-member <team-id> <user-id> -y
obs team update-role <team-id> <user-id> --role member
```

## Config-as-code

Manage your stack declaratively. See the [config-as-code guide](../guides/config-as-code.md) for the full `obs.json` shape.

```bash
obs export                  # Export all remote resources to obs.json (suite scripts included)
obs export -f my-stack.json # Export to a custom file
obs export --no-scripts     # Omit suite Playwright scripts (lighter, config-only)
obs apply --dry-run         # Preview the diff without writing
obs apply                   # Apply obs.json
obs apply -f my-stack.json  # Apply a specific file
```

`apply` updates only changed resources. It also accepts a single-resource file (bare, wrapped, or with an explicit `type`); the bare form supports `monitor`, `check`, and `heartbeat`. `incidents` and new `suites` cannot be created through `apply`. Status-page monitor attachments are excluded — manage them via `obs status-page add-monitor / remove-monitor`.
