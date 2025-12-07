# Changelog

All notable changes to the ObserveOne CLI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.3] - 2025-12-02

### Fixed

- **API Key Option Parsing**: Fixed issue where --api-key option wasn't working properly in all scenarios
  - Now supports both global `obs --api-key <key> login` and command-specific `obs login --api-key <key>` usage
  - Proper prioritization: command-specific options take precedence over global options, which take precedence over stored config values
  - Maintains backward compatibility with existing functionality

## [1.1.2] - 2025-12-01

### Added

- Added verbose mode to `list` command (`-v` flag) - shows additional fields including prompt, status, uptime percentage, and last updated date

## [1.1.1] - 2025-12-01

### Fixed

- **Critical**: Fixed API authentication header - CLI now uses `x-obs-cli` header instead of `Authorization: Bearer` to match backend expectations
- **Critical**: Fixed SSE (Server-Sent Events) authentication for live test progress updates
- Fixed `--api-url` flag not working - API client now reads URL dynamically from ConfigManager
- Fixed API URL persistence - login command now saves the API URL used during authentication
- Fixed Windows URL opening bug where `&` character in URLs was truncated by properly quoting URLs
- Updated README with correct package name (`observeone-cli` instead of `@observeone/cli`)

### Changed

- API client now sets `baseURL` dynamically on each request, allowing `--api-url` override to work correctly
- Login command now saves both API key and API URL to config for persistent sessions
- Execution logs now stored globally in config directory instead of project `.obs/logs/`
  - Windows: `%APPDATA%/observeone-nodejs/Config/logs/`
  - macOS/Linux: `~/.config/observeone-nodejs/logs/`

## [1.1.0] - 2025-12-01

### Initial Release

First public release of the ObserveOne CLI to npm.

### Added

- **Secure Authentication**: `obs login` command with polling-based browser authentication
  - Backend-initiated auth sessions with Redis storage
  - PKCE-like flow with code verifier validation
  - Browser-based user approval via frontend
  - Automatic session expiration (5 minutes)
  - API key authentication support via `--api-key` flag

- **Test Management**: `obs list` command to view available tests
  - Table format output (default)
  - JSON format output with `--format json`

- **Test Execution**: `obs ai-check` command for running AI-powered browser tests
  - Run tests by name or ID
  - Run multiple tests in sequence
  - Ad-hoc test execution without saving to database
  - Real-time progress monitoring with live step updates
  - Verbose mode for detailed execution logs
  - Screenshot tracking during execution
  - Multiple output formats: console, JUnit XML, JSON
  - Automatic log file generation to `.obs/logs/`

- **Global Options**:
  - Verbose output mode (`-v, --verbose`)
  - JSON output format (`--json`)
  - API URL and key overrides (`--api-url`, `--api-key`)
  - Configuration file support (`.obs.config.json`)
  - Automatic development mode detection

### Fixed

- Windows URL opening with special characters (`&` properly quoted)
- Cross-platform URL handling (Windows, macOS, Linux)

---

## Upcoming

- Non-interactive authentication for CI/CD environments
- Additional test management commands
- Test scheduling and automation features
