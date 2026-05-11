# Contributing to ObserveOne CLI

Thanks for your interest in improving `obs`. This document covers how to set up a local dev environment, run the test suites, and submit a change.

## Prerequisites

- Node.js 16 or newer
- pnpm (the repo uses pnpm workspaces)
- An ObserveOne account if you want to run end-to-end tests against a live backend

## Setup

```bash
git clone https://github.com/Observeone1/ObserveOne-CLI.git
cd ObserveOne-CLI
pnpm install
```

## Running the CLI locally

Use `pnpm dev` to run the CLI straight from TypeScript without building:

```bash
pnpm dev --help
pnpm dev monitor list
pnpm dev login
```

Arguments after `pnpm dev` are passed directly to the CLI — no `--` separator needed.

## Building

```bash
pnpm build
```

The build step compiles TypeScript to `dist/` and is what `npm publish` ships.

## Tests

The repo has two layers:

- **Unit tests** — Vitest. Fast, no network.
  ```bash
  pnpm test
  ```
- **End-to-end tests** — custom runner that spawns the real CLI binary. Requires a valid `e2e/.env` with `OBS_API_URL` and `OBS_API_KEY`.
  ```bash
  pnpm test:e2e
  pnpm test:e2e --ci   # strip chalk colors for clean CI logs
  ```

See [`docs/architecture/e2e-testing.md`](docs/architecture/e2e-testing.md) for how the e2e framework works.

## Quality gates

CI runs the same chain on every PR. Run them locally before pushing:

```bash
pnpm type-check
pnpm lint
pnpm format
pnpm knip       # flags unused exports and deps
pnpm test
pnpm build
```

A pre-commit hook (Husky) runs lint + format on staged files.

## Project layout

See [`docs/architecture/implementation-summary.md`](docs/architecture/implementation-summary.md) for an overview of `src/` and the design patterns the codebase follows (agent-first JSON envelope, service injection, batched execution).

## Pull request workflow

1. Fork and create a branch off `main`.
2. Make your change. Keep commits focused and the diff small.
3. Add or update tests — unit tests for logic, e2e tests for new commands or flags.
4. Update [`CHANGELOG.md`](CHANGELOG.md) under an `Unreleased` heading (or the next pending version) describing user-visible changes.
5. Run the quality gates above.
6. Open a PR with a clear description of what changed and why.

## Adding a new command

1. Create `src/commands/<name>/index.ts` exporting a factory that takes the shared services and returns a `Command`.
2. Register it in `src/index.ts`.
3. Wire it through the `OutputService` so it honors `--json` mode (every command must return a valid `JsonEnvelope`).
4. Add an e2e test under `e2e/tests/<name>/`.
5. Document it in `docs/reference/cli-commands.md` and the README's command list.

## Reporting bugs

Open an issue with:
- CLI version (`obs --version`)
- Node version
- Exact command you ran (with secrets redacted)
- What you expected vs. what happened
- `--verbose` output if relevant

## License

By contributing, you agree that your contributions will be licensed under the MIT license that covers the project.
