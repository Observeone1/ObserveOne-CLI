# ObserveOne CLI

AI-powered website monitoring and testing from your terminal. Run intelligent browser tests directly from the command line with real-time progress updates.

## Installation

```bash
npm install -g @observe1/cli
```

## Quick Start

1. **Login to ObserveOne**

   ```bash
   obs login
   ```

2. **List your tests**

   ```bash
   obs list
   ```

3. **Run a test**

   ```bash
   obs ai-check my-test
   ```

## Commands

### `obs login`

Authenticate with the ObserveOne platform.

```bash
# Interactive login (opens browser)
obs login

# Login with API key
obs login --api-key <your-api-key>
```

**Options:**

- `-k, --api-key <key>` - API key for authentication

---

### `obs list`

List all your available tests.

```bash
# Display as a table
obs list

# Output as JSON
obs list --format json
```

**Options:**

- `-f, --format <format>` - Output format: `table` (default) or `json`

---

### `obs ai-check`

Run AI-powered browser tests with live progress updates.

```bash
# Run test by name
obs ai-check my-test

# Run multiple tests
obs ai-check test1 test2 test3

# Run test by ID
obs ai-check 123

# Run with verbose output (see detailed steps)
obs ai-check my-test --verbose

# Run ad-hoc test (without saving to database)
obs ai-check --url https://example.com --prompt "Click the login button"

# Generate JUnit report
obs ai-check my-test --reporter junit --output results.xml
```

**Options:**

- `-u, --url <url>` - URL to test (for ad-hoc tests)
- `-p, --prompt <prompt>` - Test instructions (for ad-hoc tests)
- `-n, --name <name>` - Test name (for ad-hoc tests)
- `-d, --description <description>` - Test description (for ad-hoc tests)
- `-t, --timeout <timeout>` - Timeout in milliseconds (default: 300000)
- `-v, --verbose` - Show detailed step-by-step execution
- `--adhoc` - Run as ad-hoc test without saving
- `--reporter <reporter>` - Output reporter: `console` (default), `junit`, or `json`
- `-o, --output <file>` - Output file for reports

**Live Progress Features:**

- **Real-time updates**: Watch your test execution live with step-by-step progress
- **Compact mode** (default): Shows spinner with current step and elapsed time
- **Verbose mode** (`--verbose`): Displays detailed logs of every action
- **Screenshot tracking**: Shows count of screenshots captured
- **Log files**: Full execution logs saved to `.obs/logs/execution-<id>.log`

---

## Global Options

Available for all commands:

```bash
obs <command> [options]
```

**Options:**

- `-v, --verbose` - Enable verbose output
- `--json` - Output in JSON format
- `--api-url <url>` - Override API URL
- `--api-key <key>` - Override API key
- `--version` - Show version number
- `--help` - Show help

## Configuration

### Global Configuration

Stored in your system's config directory:

- **macOS/Linux**: `~/.config/obs/config.json`
- **Windows**: `%APPDATA%/obs/config.json`

### Project Configuration

Create `.obs.config.json` in your project root:

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

### Environment Variables

```bash
# Override API URL
export OBS_API_URL=https://api.observeone.com

# Override API key
export OBS_API_KEY=your-api-key

# Enable verbose mode
export OBS_VERBOSE=true

# Enable JSON output
export OBS_JSON_OUTPUT=true
```

## Examples

### Run tests and watch progress

```bash
# Run with compact progress (default)
obs ai-check homepage-test

# Run with detailed step-by-step output
obs ai-check homepage-test --verbose
```

### Ad-hoc testing

```bash
# Quick test without saving
obs ai-check \
  --url https://example.com \
  --prompt "Navigate to login page and verify the form exists" \
  --name "Login Page Check"
```

### CI/CD Integration

```bash
# Generate JUnit XML for CI systems
obs ai-check my-test --reporter junit --output test-results.xml

# JSON output for parsing
obs ai-check my-test --reporter json --output results.json

# Exit code: 0 for success, 1 for failure
obs ai-check my-test && echo "Tests passed!"
```

## Logs

Detailed execution logs are automatically saved to your system's config directory:

- **Windows**: `%APPDATA%\observeone-nodejs\Config\logs\`
- **macOS/Linux**: `~/.config/observeone-nodejs/logs/`

Log files are named: `execution-<task-id>-<timestamp>.log`

Each log includes:

- Timestamp
- Step-by-step actions
- Goals and results
- Screenshot captures
- Final completion status

## Support

- **npm**: [npmjs.com/package/@observeone/cli](https://www.npmjs.com/package/@observeone/cli)

## License

MIT

---

**Happy Testing! 🚀**
