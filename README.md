# ObserveOne CLI

AI-powered website monitoring and testing from your terminal. Run intelligent browser tests directly from the command line with real-time progress updates.

## Installation

```bash
npm install -g @observeone/cli
```

## Quick Start

1. **Login to ObserveOne**

   ```bash
   obs1 login
   ```

2. **List your tests**

   ```bash
   obs1 list
   ```

3. **Run a test**

   ```bash
   obs1 ai-check my-test
   ```

## Commands

### `obs1 login`

Authenticate with the ObserveOne platform.

```bash
# Interactive login (opens browser)
obs1 login

# Login with API key
obs1 login --api-key <your-api-key>
```

**Options:**

- `-k, --api-key <key>` - API key for authentication

**Note:** The interactive login currently requires you to be logged into the ObserveOne dashboard first.

---

### `obs1 list`

List all your available tests.

```bash
# Display as a table
obs1 list

# Output as JSON
obs1 list --format json
```

**Options:**

- `-f, --format <format>` - Output format: `table` (default) or `json`

---

### `obs1 ai-check`

Run AI-powered browser tests with live progress updates.

```bash
# Run test by name
obs1 ai-check my-test

# Run multiple tests
obs1 ai-check test1 test2 test3

# Run test by ID
obs1 ai-check 123

# Run with verbose output (see detailed steps)
obs1 ai-check my-test --verbose

# Run ad-hoc test (without saving to database)
obs1 ai-check --url https://example.com --prompt "Click the login button"

# Generate JUnit report
obs1 ai-check my-test --reporter junit --output results.xml
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
- **Log files**: Full execution logs saved to `.obs1/logs/execution-<id>.log`

---

## Global Options

Available for all commands:

```bash
obs1 <command> [options]
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

- **macOS/Linux**: `~/.config/obs1/config.json`
- **Windows**: `%APPDATA%/obs1/config.json`

### Project Configuration

Create `.obs1.config.json` in your project root:

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
export OBS1_API_URL=https://api.observeone.com

# Override API key
export OBS1_API_KEY=your-api-key

# Enable verbose mode
export OBS1_VERBOSE=true

# Enable JSON output
export OBS1_JSON_OUTPUT=true
```

## Examples

### Run tests and watch progress

```bash
# Run with compact progress (default)
obs1 ai-check homepage-test

# Run with detailed step-by-step output
obs1 ai-check homepage-test --verbose
```

### Ad-hoc testing

```bash
# Quick test without saving
obs1 ai-check \
  --url https://example.com \
  --prompt "Navigate to login page and verify the form exists" \
  --name "Login Page Check"
```

### CI/CD Integration

```bash
# Generate JUnit XML for CI systems
obs1 ai-check my-test --reporter junit --output test-results.xml

# JSON output for parsing
obs1 ai-check my-test --reporter json --output results.json

# Exit code: 0 for success, 1 for failure
obs1 ai-check my-test && echo "Tests passed!"
```

## Logs

Detailed execution logs are automatically saved to:

```
.obs1/logs/execution-<task-id>.log
```

Each log includes:

- Timestamp
- Step-by-step actions
- Goals and results
- Screenshot captures
- Final completion status

## Support

- **Documentation**: [docs.observeone.com](https://docs.observeone.com)
- **Issues**: [github.com/observeone/cli/issues](https://github.com/observeone/cli/issues)
- **npm**: [npmjs.com/package/@observeone/cli](https://www.npmjs.com/package/@observeone/cli)

## License

MIT

---

**Happy Testing! 🚀**
