---
title: E2E Testing Framework
description: Understand how the CLI validates its execution paths
---

# E2E Testing Framework

The ObserveOne CLI ships with a custom, zero-dependency End-to-End (E2E) testing framework designed explicitly for validating real terminal output and API integration.

## Architecture

Instead of relying on heavy frameworks like Jest or Vitest, the E2E suite uses Node's native `child_process.spawn`. This allows the test runner to:
1. Spin up the actual CLI binary (`dist/index.js`).
2. Pipe real inputs and flags.
3. Capture raw `stdout` and `stderr` streams for assertion.

### Binary Modes
The test runner is highly flexible. By setting the `OBS_BINARY_MODE` environment variable, you can test different compilation stages:
- `local` (Default): Tests the locally compiled TypeScript (`dist/index.js`).
- `npx`: Tests the live npm package (`npx @observe1/cli`).
- `global`: Tests a globally installed version (`obs`).

## Running Tests

Before running tests locally, you must provide a valid API endpoint and API key in an `e2e/.env` file.

```bash
# Compile the TypeScript
pnpm run build

# Run the test suite
pnpm test:e2e

# Run the test suite in CI mode (strips chalk colors for clean logs)
pnpm test:e2e --ci
```

## Teardown Hooks (State Leakage)

The `resource-management.test.ts` file tests the complete `create` -> `read` -> `update` -> `delete` lifecycle for all ObserveOne primitives. 

To prevent dangling resources from polluting the database if an assertion fails midway through a test, all lifecycle tests are strictly wrapped in `try/finally` blocks. If an error is caught, the `finally` block detects the orphaned resource ID and executes a targeted `obs delete <id> -y` command before exiting.
