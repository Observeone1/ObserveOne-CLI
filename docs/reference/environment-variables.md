---
title: Environment Variables
description: Configure the ObserveOne CLI via environment variables for CI/CD and AI Agent automation
---

You can configure the ObserveOne CLI globally using standard environment variables. This is especially useful for CI/CD pipelines, Docker containers, or autonomous AI agents.

### `OBS_API_KEY`
Bypasses the `obs login` configuration file and directly injects your authentication token.
```bash
export OBS_API_KEY="obs1_your_secure_api_key_here"
```

### `OBS_JSON_OUTPUT`
Forces the CLI to output strict `JsonEnvelope` payloads for every command, silencing all human-readable UI elements. Identical to passing `--json`.
```bash
export OBS_JSON_OUTPUT="true"
```

### `OBS_VERBOSE`
Enables verbose output, including detailed API execution logs and stack traces on failure.
```bash
export OBS_VERBOSE="true"
```

### Headless Provisioning Variables
If you are running `obs login --headless`, the CLI expects these variables to securely mint a new API key without interactive browser prompts:
```bash
export OBS_EMAIL="agent@yourcompany.com"
export OBS_PASSWORD="secure-password"
```
