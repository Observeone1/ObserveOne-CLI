# Changelog

All notable changes to the ObserveOne CLI project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.1] - 2026-03-15

### Security Rollback
- **Removed**: `obs signup` command and the corresponding `/api/auth/agent/signup` backend endpoint have been removed to close a potential abuse vector for automated account creation. 

## [1.2.0] - 2026-03-15

### Added
- **Background Update Service**: CLI now automatically checks for new versions on npm and notifies the user (non-blocking, skipped in JSON mode).
- **ResourceCommandFactory**: Reified architecture for all resource commands, ensuring 100% consistent CRUD behavior.
- **Project-wide Strict Typing**: Removed all `any` types and achieved 100% TypeScript compliance.

### Fixed
- **Config Priority**: CLI now correctly honors local `.obs.config.json` files over global OS storage.
- **Resource Gaps**: Added missing `grace_period` and `description` fields to declarative sync (`obs apply`).
- **Error UX**: Standardized global error handling to ensure `JsonEnvelope` symmetry even on fatal crashes.
- **Lint Hardening**: Resolved 130+ lint warnings and hardened ESLint configuration.

## [1.1.0] - 2026-03-15

### Added
- `obs signup` command for creating secure accounts for AI agents (rate-limited)
- `obs init` command for standalone workspace/project configuration setup

### Improved
- Decoupled interactive project setup from `obs login` to streamline authentication friction

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
