---
title: Config-as-Code (Declarative Workflow)
description: Manage your ObserveOne infrastructure using JSON
---

# Config-as-Code

ObserveOne supports an Infrastructure-as-Code (IaC) workflow. You can define all your monitors, API checks, and heartbeats in a single JavaScript Object Notation (JSON) file and seamlessly synchronize them to your account.

This declarative approach is perfect for version-controlling your monitoring setup alongside your application code, or for allowing AI agents to orchestrate complex testing environments autonomously.

## Generating a Config File

If you already have resources created via the ObserveOne web dashboard, you don't need to write a configuration file from scratch. You can pull your existing remote state into a local JSON file.

```bash
# Fetches all remote resources and generates obs.json in the current directory
obs export

# Save to a custom file name
obs export -f my-stack.json
```

## Synchronizing Changes

Once you have your `obs.json` file, you can edit it locally. You can modify existing fields (like changing a `timeout_ms`) or copy-paste a block to define a brand new resource. If `obs.json` is missing but `observeone.json` exists, `obs apply` will use `observeone.json` automatically.

To synchronize your local file with the ObserveOne backend, run:

```bash
obs apply
```

### How `obs apply` Works

The `apply` command uses a **stateless upsert** strategy:
1. It reads the local JSON array of resources.
2. It fetches the current state from the backend API.
3. It intelligently matches resources using the `name` field.
4. **Update:** If a local resource `name` matches a remote resource, the CLI fires an `update` API call to sync the properties.
5. **Create:** If a local resource `name` does not exist remotely, the CLI fires a `create` API call.
6. **Batched Execution:** To prevent rate limiting (429 errors), the CLI automatically groups your configuration into batches of 5 and processes them with strict 1-second delays.

## Schema Reference

To see the exact fields allowed in the JSON configuration, check out the [JSON Schema Reference](../reference/json-schema.md).
