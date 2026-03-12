---
title: CLI Reference
description: Exhaustive list of all manual CRUD and operational commands
---

The `obs` CLI provides comprehensive manual resource management.

## Monitors
Manage basic HTTP ping monitors.
```bash
obs monitor create --name "Frontend" --url "https://example.com" --interval "*/5 * * * *"
obs monitor list
obs monitor get <id>
obs monitor update <id> --name "Updated Frontend"
obs monitor toggle <id>   # Pause or resume execution
obs monitor delete <id> -y
```

## API Checks
Manage complex API health checks.
```bash
obs check create --name "Auth API" --url "https://api.example.com/auth" --method "POST"
obs check list
obs check get <id>
obs check update <id> --method "GET"
obs check toggle <id>    # Pause or resume execution
obs check delete <id> -y
```

## Heartbeats
Manage heartbeat checks (for monitoring background jobs or cron tasks).
```bash
obs heartbeat create --name "Daily Backup" --period 86400
obs heartbeat list
obs heartbeat get <id>
obs heartbeat update <id> --period 43200
obs heartbeat toggle <id> # Pause or resume execution
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
```

## Config-as-Code
Manage your infrastructure declaratively.
```bash
obs export               # Export all remote resources to observeone.json
obs apply                # Synchronize local obs.json with the backend
obs apply -f custom.json # Use a specific configuration file
```
