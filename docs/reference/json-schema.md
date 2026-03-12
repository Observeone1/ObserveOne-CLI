---
title: JSON Schema Reference
description: The obs.json configuration schema
---

# JSON Schema

When using `obs apply`, the CLI expects your `obs.json` file to follow this JavaScript Object Notation (JSON) structure. All arrays are optional. If `obs.json` is not found but `observeone.json` exists, the CLI will use `observeone.json`.

```json
{
  "monitors": [
    {
      "name": "Production Website",
      "url": "https://example.com",
      "interval": "*/5 * * * *",
      "cron_expression": "*/5 * * * *",
      "timeout_ms": 30000,
      "alert_on_failure": true
    }
  ],
  "api_checks": [
    {
      "name": "Health API",
      "url": "https://api.example.com/health",
      "method": "GET",
      "timeout_ms": 30000,
      "alert_on_failure": true
    }
  ],
  "heartbeats": [
    {
      "name": "Database Backup Job",
      "period": 86400,
      "grace_period": 60,
      "description": "Runs daily at 2 AM"
    }
  ],
  "ai_checks": [
    {
      "name": "Checkout Flow",
      "url": "https://demo.example.com",
      "prompt": "Add item to cart and verify checkout page loads",
      "description": "Created via CLI"
    }
  ]
}
```

### Heartbeat Grace Period
Both `grace` and `grace_period` are accepted for heartbeats; `grace_period` is preferred for clarity.

### Matching Behavior
The CLI uses the `name` field as the primary unique identifier to match local definitions against remote resources during synchronization. Changing a name locally will result in a new resource being created.
