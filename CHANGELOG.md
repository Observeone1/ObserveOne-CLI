# Changelog

All notable changes to the ObserveOne CLI project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.1] - 2026-03-16

### Fixed
- `obs login help` now shows command help instead of running login.

## [1.4.0] - 2026-03-16

### Added
- **Alert Channels**: New `obs alert-channel` CRUD commands.
- **Status Pages**: New `obs status-page` CRUD commands.
- **Incidents**: New `obs incident` CRUD commands.
- **E2E Coverage**: Lifecycle tests for alert channels, status pages, and incidents.

### Fixed
- **Resource Factory**: Allow resources without a `name` field.
- **Update Payloads**: Avoid sending null optional fields for status pages and incidents.

## [1.3.2] - 2026-03-16

### Fixed
- **Update Notice Box**: Dynamic sizing to prevent misaligned borders with longer version strings.
- **Command Option Parsing**: Normalize option resolution to ensure update/create/delete/toggle flags are read consistently.

## [1.3.1] - 2026-03-15

### Added
- **Config Transparency**: Added verbose logging (`-v`) to show exactly which source (Environment, Local Config, or Global Store) provided the API key.
- **Login Safety Check**: `obs login` now warns if an existing `OBS_API_KEY` in the environment will shadow the newly provisioned session.

### Fixed
- **Apply Delta Sync**: Corrected property mapping for URL monitors to ensure delta-optimization works as expected.
- **E2E Test Hardening**: Enhanced test runner with dynamic auth bootstrapping and environment isolation.

## [1.3.0] - 2026-03-15

### Added
- `obs logout` command to clear local authentication credentials.
- `--force` (`-f`) flag to `obs login` to bypass existing credentials and initiate a fresh authentication flow.

### Improved
- Standardized authentication flow to better handle pre-provisioned environment variables vs stored configuration.

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
