# Changelog

All notable changes to the ObserveOne CLI project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.3] - 2026-03-12

### Fixed
- Enforced JSON mode consistency across commands, including `ai-check run` immediate JSON output unless `--wait`
- Added JSON outputs for toggle commands and JSON apply now exits non-zero on errors
- Removed legacy `obs list` command and updated references
- Default export file is now `obs.json` (with `observeone.json` fallback) and docs aligned to match
- Split CI checks into separate jobs for clearer status signals

## [1.0.2] - 2026-03-12

### Added
- Delta optimization for `obs apply` command to skip unnecessary API updates
- Deep equality comparison utility for resource diffing
- 'Unchanged' counter in apply summary output

### Benefits
- Reduced API calls when resources are unchanged
- Faster sync times for large configurations
- Clearer output showing created, updated, and unchanged counts

## [1.0.1] - 2026-03-12

### Fixed
- Silenced dotenv startup message that appeared on every command execution

## [1.0.0] - 2026-03-12

### Added
- **Authentication**: OAuth2 login flow with secure local API key storage
- **Config-as-Code**: Declarative workflow with `obs export` and `obs apply` using `observeone.json`
- **Resource CRUD**: Full management for Monitors, API Checks, and Heartbeats (create, read, update, delete, toggle)
- **AI Testing**: AI-powered browser test generation with `obs ai-check run`
- **Headless Mode**: JSON output envelope for CI/CD pipelines and AI agent automation
- **Infrastructure-as-Code**: Git-versionable monitoring configuration
- **Cross-platform Support**: Works on macOS, Linux, and Windows
- **Unit Tests**: Vitest setup with tests for ConfigService, ApiClient, and OutputService
- **E2E Tests**: Comprehensive end-to-end test suite for all CLI commands
- **CI/CD**: GitHub Actions workflow with lint, type-check, build, unit, and E2E test jobs

### Commands
- `obs login` / `obs logout` - Authenticate with ObserveOne
- `obs export` / `obs apply` - Sync configuration (Infrastructure-as-Code workflow)
- `obs monitor` - URL Monitor management (CRUD)
- `obs check` - API Check management (CRUD)
- `obs heartbeat` - Heartbeat Monitor management (CRUD)
- `obs ai-check` - AI-powered test generation and execution
- `obs version` / `obs help` - Utility commands

### Technical
- Built with TypeScript
- Published via npm as `@observeone/cli`
- Requires Node.js >= 16.0.0
