# ObserveOne CLI

AI-powered website monitoring, synthetic testing, and infrastructure-as-code from your terminal.

The `obs` CLI allows developers and AI Agents to manage URL Monitors, API Checks, Heartbeats, and AI Browser tests using simple commands or declarative JSON configuration files.

## Installation

```bash
npm install -g @observe1/cli
```

## Quick Start

1. **Login to ObserveOne**
   ```bash
   obs login
   ```

2. **Pull your existing configuration**
   ```bash
   obs export
   ```

3. **Manage a monitor**
   ```bash
   obs monitor create --name "My Website" --url "https://example.com" --interval "*/5 * * * *"
   obs monitor list
   ```

---

## 🏗️ Config-as-Code (Declarative Workflow)

ObserveOne supports an Infrastructure-as-Code (IaC) workflow using JSON. You can define all your monitors, API checks, and heartbeats in a single `observeone.json` file and sync them to your account.

### `obs export`
Fetch all your existing remote resources from the ObserveOne backend and save them locally.
```bash
# Generates observeone.json in the current directory
obs export

# Save to a custom file
obs export -f my-stack.json
```

### `obs apply`
Sync your local JSON configuration to the ObserveOne backend. The CLI will automatically detect matching resources and perform surgical `create` and `update` API calls.
```bash
# Sync observeone.json
obs apply

# Sync a custom file
obs apply -f my-stack.json
```

**Example `observeone.json` schema:**
```json
{
  "monitors": [
    {
      "name": "Production Website",
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
      "period": 86400
    }
  ]
}
```

---

## 🛠️ Resource Management (CRUD)

You can manually create, read, update, delete, and toggle individual resources directly from the terminal.

### URL Monitors
Manage basic HTTP ping monitors.
```bash
obs monitor create --name "Frontend" --url "https://example.com" --interval "*/5 * * * *"
obs monitor list
obs monitor get <id>
obs monitor update <id> --name "Updated Frontend" --interval "*/10 * * * *"
obs monitor toggle <id>
obs monitor delete <id> -y
```

### API Checks
Manage complex API health checks.
```bash
obs check create --name "Auth API" --url "https://api.example.com/auth" --method "POST"
obs check list
obs check update <id> --method "GET"
obs check toggle <id>
obs check delete <id> -y
```

### Heartbeats (Cron Monitoring)
Manage heartbeat checks (for monitoring background jobs or cron tasks).
```bash
obs heartbeat create --name "Daily Backup" --period 86400
obs heartbeat list
obs heartbeat update <id> --period 43200
obs heartbeat toggle <id>
obs heartbeat delete <id> -y
```

### AI Browser Checks
Manage and execute intelligent Playwright-driven browser tests using natural language prompts.
```bash
obs ai-check create --name "Login Flow" --url "https://app.com" --prompt "Login with test@example.com"
obs ai-check list
obs ai-check get <id>
obs ai-check delete <id> -y
```

#### Running AI Checks
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

---

## 🤖 AI Agent Integration (Headless Mode)

The `obs` CLI is explicitly designed to be used by AI coding agents (like Cursor, GitHub Copilot, Claude Code, or custom bots). 

### The `--json` Flag
Append `--json` to **any** command. The CLI will automatically suppress all human-readable output (chalk colors, loading spinners, raw logs) and return a strict, machine-readable `JsonEnvelope`.

```bash
obs monitor list --json
obs apply -f my-stack.json --json
```

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
*(If an error occurs, `status` will be `"ERROR"` and the envelope will contain a strict `error` object, preventing the agent's JSON parser from crashing).*

### Headless Authentication
Agents can authenticate securely using environment variables without interactive browser prompts:
```bash
export OBS_EMAIL="agent@company.com"
export OBS_PASSWORD="secure-password"

# Automatically provisions and saves an API key to local config
obs login --headless
```

Alternatively, inject an existing API key directly into the environment:
```bash
export OBS_API_KEY="your_api_key_here"
```

---

## ⚙️ Global Configuration

Available for all commands:
```bash
obs <command> [options]
```

**Options:**
- `-v, --verbose` - Enable verbose output and stack traces
- `--json` - Output in strict JSON format
- `--api-url <url>` - Override API URL
- `--api-key <key>` - Override API key
- `--version` - Show version number
- `--help` - Show help

### Environment Variables
```bash
export OBS_API_URL=https://api.observeone.com
export OBS_API_KEY=your-api-key
export OBS_VERBOSE=true
export OBS_JSON_OUTPUT=true
```

## License
MIT

---
**Happy Testing! 🚀**
