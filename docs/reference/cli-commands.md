---
title: CLI Commands
description: Exhaustive list of all manual CRUD and operational commands
---

# CLI Commands

The `obs` command-line interface (CLI) provides comprehensive manual create, read, update, delete (CRUD) resource management.

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
obs heartbeat create --name "Daily Backup" --period 86400
obs heartbeat list
obs heartbeat get <id>
obs heartbeat update <id> --period 43200
obs heartbeat toggle <id>
obs heartbeat delete <id> -y
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
