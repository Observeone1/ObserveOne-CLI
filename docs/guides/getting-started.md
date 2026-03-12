---
title: Getting Started
description: Install and authenticate with the ObserveOne CLI
---

The ObserveOne CLI (`obs`) allows developers and AI Agents to manage URL Monitors, API Checks, Heartbeats, and AI Browser tests directly from the terminal.

## Installation

Install the CLI globally using npm:

```bash
npm install -g @observeone/cli
```

## Authentication

Before managing resources, you need to authenticate with your ObserveOne account.

### Interactive Login

For human developers, the easiest way is to use the interactive login command:

```bash
obs login
```
This will open your default web browser and securely complete the OAuth/SSO flow. After login, you will be prompted to set up a `.obs.config.json` project file in your current directory.

### Headless Agent Login

If you are configuring an autonomous AI coding agent (like Claude Code or Cursor) or running in a CI/CD pipeline, you can provision an API key headlessly using your account credentials:

```bash
export OBS_EMAIL="agent@yourcompany.com"
export OBS_PASSWORD="secure-password"

obs login --headless
```

Alternatively, if you already have an API key from the ObserveOne dashboard, you can bypass the login command entirely by exporting it to your environment:

```bash
export OBS_API_KEY="your-api-key"
```

### Global Options

These options can be used with any command:

- `--api-key <key>`: Override the stored API key.
- `--json`: Output results in strict JSON format.
- `--verbose`: Enable detailed execution logs.

## Project Configuration

When you run `obs login`, the CLI creates a `.obs.config.json` file. This file contains project-specific defaults:

```json
{
  "project": {
    "name": "My Project",
    "description": "AI-powered test automation project"
  },
  "defaultOptions": {
    "timeout": 600000,
    "retries": 3,
    "verbose": false
  }
}
```

## Next Steps

- Learn how to manage infrastructure declaratively in the [Config-as-Code Guide](./config-as-code.md).
- Explore the manual CRUD commands in the [CLI Reference](../reference/cli-commands.md).
