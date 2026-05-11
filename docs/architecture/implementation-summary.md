---
title: Implementation Summary
description: Architecture overview and design patterns
---

# Implementation Summary

This document is for contributors. It walks through how the CLI is laid out and the patterns the codebase relies on.

## 📦 Package Structure

```
cli/
├── src/
│   ├── index.ts                 # Main CLI entry point
│   ├── commands/                # CLI command definitions (apply, export, monitor, etc.)
│   ├── interfaces/              # TypeScript interfaces for services
│   ├── services/                # Service implementations (API client, config, output)
│   ├── types/                   # TypeScript type definitions
│   └── utils/                   # Utility functions
├── e2e/                         # Custom end-to-end testing suite
│   ├── lib/                     # E2E test runner utilities
│   └── tests/                   # E2E test scenarios
├── docs/                        # Static markdown documentation
├── scripts/
│   └── build.js                 # Build script
├── package.json                 # Package configuration
└── tsconfig.json                # TypeScript configuration
```

## 🎯 Design Patterns

### 1. Agent-First JSON Envelope
The CLI is designed to be driven by AI coding agents (Claude, Cursor, GitHub Copilot) as well as humans. When `--json` is passed, the `OutputService` silences spinners, chalk colors, and human-readable logs so the only thing on stdout is a machine-parseable envelope.

Instead, every single command is guaranteed to return a strict `JsonEnvelope` payload:
`{ status: "SUCCESS" | "ERROR", data: {...} }`

### 2. Service Injection
All services (like `ApiClient`, `ConfigService`, and `OutputService`) are instantiated at the root entrypoint and injected into command factory functions. This keeps dependencies explicit and testable without a container.

### 3. Batched Execution (Rate Limiting)
Commands that process large payloads (e.g. `obs apply` against an `obs.json` with dozens of monitors) chunk work into concurrent batches of 5 via `Promise.all`, with a 1000ms delay between batches. This stays under the backend's 100 req/minute rate limit and avoids `429` responses.
