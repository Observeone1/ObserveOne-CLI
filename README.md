# ObserveOne CLI

A powerful command-line interface for ObserveOne - AI-powered application monitoring platform. Run intelligent browser tests from your terminal with ease. Includes Monitoring as Code capabilities for defining and deploying tests from code.

## Installation

### Global Installation

```bash
npm install -g obs1
```

### Local Installation

```bash
npm install obs1
npx obs1 --help
```

## Quick Start

1. **Authenticate with ObserveOne** (automatically sets up project config)

   ```bash
   obs1 login
   ```

2. **Initialize a new project** (for Monitoring as Code workflow)

   ```bash
   obs1 init
   ```

3. **List available tests**

   ```bash
   obs1 list
   ```

4. **Run tests**

   ```bash
   obs1 ai-check my-test
   ```

5. **Deploy local test definitions** (Monitoring as Code)

   ```bash
   obs1 deploy
   ```

6. **Test definitions locally** (Validation before deployment)

   ```bash
   obs1 test
   ```

## Commands

### `obs1 login`

Authenticate with the ObserveOne platform.

```bash
obs1 login
obs1 login --api-key <your-api-key>
```

**Options:**

- `-k, --api-key <key>` - API key for authentication

**Note:** Project configuration is automatically set up during `obs1 login` if no `\.obs1.config.json` exists.

### `obs1 init`

Initialize a new ObserveOne project with Monitoring as Code configuration.

```bash
obs1 init
obs1 init --project-name "My Project" --description "My test project"
```

**Options:**

- `--project-name <name>` - Name of the project
- `--description <desc>` - Project description

### `obs1 list`

List all available tests.

```bash
obs1 list
obs1 list --format json
```

**Options:**

- `-f, --format <format>` - Output format (table, json)

### `obs1 deploy`

Deploy local test definitions to the platform (Monitoring as Code).

```bash
obs1 deploy                    # Deploy all test definition files
obs1 deploy my-test.obs1.js   # Deploy specific files
obs1 deploy --all              # Deploy all test definitions
obs1 deploy --preview          # Show what would be deployed without making changes
```

**Options:**

- `--all` - Deploy all test definition files in the project
- `--preview` - Show what would be deployed without making changes
- `--dry-run` - Validate definitions without deploying
- `--include <pattern>` - Glob pattern for files to include
- `--exclude <pattern>` - Glob pattern for files to exclude

### `obs1 test`

Test definitions locally before deployment (Monitoring as Code).

```bash
obs1 test                      # Test all definition files
obs1 test my-test.obs1.js     # Test specific files
obs1 test --validate-only      # Only validate syntax, don't execute
```

**Options:**

- `--all` - Test all definition files
- `--validate-only` - Only validate syntax, don't execute
- `--verbose` - Show detailed validation output
- `--fail-fast` - Stop on first validation error

### `obs1 ai-check`

Run AI-powered tests.

```bash
# Run specific tests
obs1 ai-check test1 test2

# Run ad-hoc test
obs1 ai-check --url https://example.com --prompt "Click the login button"

# Automatically waits for completion
obs1 ai-check my-test

# Generate JUnit report
obs1 ai-check my-test --reporter junit --output results.xml
```

**Options:**

- `-u, --url <url>` - URL to test (for ad-hoc tests)
- `-p, --prompt <prompt>` - Test instructions (for ad-hoc tests)
- `-n, --name <name>` - Test name (for ad-hoc tests)
- `-d, --description <description>` - Test description
- `-t, --timeout <timeout>` - Timeout in milliseconds (default: 300000)
- `-w, --wait` - Wait for test completion (deprecated - now automatic)
- `--adhoc` - Run as ad-hoc test (don't save to database)
- `--reporter <reporter>` - Output reporter (console, junit, json)
- `-o, --output <file>` - Output file for reports

**Note:** The `obs1 ai-check` command automatically waits for test completion, so manual status checking is not needed.

## Key Features

- **Live Progress Monitoring**: Watch your AI tests execute in real-time with step-by-step updates.
- **Detailed Logging**: Execution logs are automatically saved to `.obs1/logs/` for debugging.
- **Simplified Authentication**: Seamless login flow for both local development and production.
- **Monitoring as Code**: Define and deploy tests directly from your codebase.

## Configuration

### Global Configuration

The CLI stores configuration in your system's config directory:

- **macOS/Linux**: `~/.config/obs1/config.json`
- **Windows**: `%APPDATA%/obs1/config.json`

### Project Configuration

Create a `.obs1.config.json` file in your project root:

```json
{
  "project": {
    "name": "My Project",
    "description": "Project description"
  },
  "apiUrl": "https://api.observeone.com",
  "defaultOptions": {
    "timeout": 300000,
    "retries": 3,
    "verbose": false
  }
}
```

## Commands

### `obs1 login`

Authenticate with the ObserveOne platform. Supports both interactive login and API key authentication.

```bash
obs1 login
obs1 login --api-key <your-api-key>
```

**Options:**

- `-k, --api-key <key>` - API key for authentication

**Note:** Project configuration is automatically set up during `obs1 login` if no `.obs1.config.json` exists.

### `obs1 ai-check`

Run AI-powered tests with real-time progress updates.

```bash
# Run specific tests with live progress
obs1 ai-check test1 test2

# Run with detailed step-by-step output
obs1 ai-check test1 --verbose

# Run ad-hoc test
obs1 ai-check --url https://example.com --prompt "Click the login button"
```

**Live Progress & Logs:**

- **Compact Mode (Default)**: Shows a spinner with current step, time elapsed, and screenshot count.
- **Verbose Mode (`--verbose`)**: Displays detailed logs of every action, goal, and result in real-time.
- **Log Files**: Full execution logs are saved to `.obs1/logs/execution-<id>.log`.

**Options:**

- `-u, --url <url>` - URL to test (for ad-hoc tests)
- `-p, --prompt <prompt>` - Test instructions (for ad-hoc tests)
- `-n, --name <name>` - Test name (for ad-hoc tests)
- `-d, --description <description>` - Test description
- `-t, --timeout <timeout>` - Timeout in milliseconds (default: 300000)
- `-v, --verbose` - Show detailed step information during execution
- `--adhoc` - Run as ad-hoc test (don't save to database)
- `--reporter <reporter>` - Output reporter (console, junit, json)
- `-o, --output <file>` - Output file for reports
