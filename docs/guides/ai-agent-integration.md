---
title: AI Agent Integration
description: How to configure autonomous AI agents to use the ObserveOne CLI
---

The ObserveOne CLI is explicitly designed to be driven by autonomous coding agents (such as Claude Code, Cursor, GitHub Copilot Workspaces, or custom bots). It features resilient machine-to-machine contracts and headless execution modes.

## The `--json` Flag

The golden rule for AI agent integration is to **always append `--json`** to your commands. 

```bash
obs monitor list --json
obs apply -f my-stack.json --json
```

When `--json` is detected, the CLI completely alters its behavior:
1. **Silences UI:** It suppresses all human-readable output (chalk colors, loading spinners, raw interactive logs, and progress bars).
2. **Guaranteed Schema:** It wraps every response in a strict `JsonEnvelope` schema.
3. **Fatal Error Trapping:** It catches unhandled internal rejections and Commander.js parsing errors, converting them into structured JSON so your agent's JSON parser never crashes.

### The JSON Envelope Schema

You can program your agent to rely on this exact interface for every command execution:

```typescript
export interface JsonEnvelope<T = any> {
  status: "SUCCESS" | "ERROR";
  data?: T;               // Present on SUCCESS
  error?: {
    message: string;      // Present on ERROR
    details?: any;
  };
  metadata: {
    timestamp: string;    // ISO-8601
  };
}
```

## Workflow Recommendations for Agents

If you are an AI Agent tasked with adding monitoring to a user's project, follow this loop:

1. **Pull State:** Run `obs export --json` to fetch the user's current infrastructure into `observeone.json`.
2. **Read & Edit:** Read `observeone.json`, append the new required API Checks or URL Monitors to the arrays, and save the file.
3. **Sync State:** Run `obs apply --json` to automatically deploy the changes.
4. **Verify:** Check the `summary` object in the JSON response to confirm successful creations/updates.
