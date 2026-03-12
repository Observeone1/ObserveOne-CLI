---
title: JSON Schema Reference
description: The observeone.json configuration schema
---

# JSON Schema

When using `obs apply`, the CLI expects your `observeone.json` file to follow this structure. All arrays are optional.

```json
{
  "monitors": [
    {
      "name": "Production Website",
      "url": "https://example.com",
      "interval": "*/5 * * * *",
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
      "description": "Runs daily at 2 AM"
    }
  ],
  "ai_checks": [
    {
      "name": "Checkout Flow",
      "url": "https://demo.example.com",
      "prompt": "Add item to cart and verify checkout page loads"
    }
  ]
}
```

### Matching Behavior
The CLI uses the `name` field as the primary unique identifier to match local definitions against remote resources during synchronization. Changing a name locally will result in a new resource being created.
