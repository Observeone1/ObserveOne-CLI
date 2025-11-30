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

## Configuration

### Global Configuration

The CLI stores configuration in your system's config directory:

- **macOS/Linux**: `~/.config/obs1/config.json`
- **Windows**: `%APPDATA%/obs1/config.json`

### Project Configuration

Create a `\.obs1.config.json` file in your project root:

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

### Test Definition Files

Monitoring as Code supports multiple test definition formats:

**JavaScript format (.obs1.js):**

```javascript
export default {
  name: "Homepage Load Test",
  description: "Test that the homepage loads correctly",
  url: "https://example.com",
  prompt: "Navigate to the homepage and verify it loads correctly"
}
```

**JSON format (.obs1.json):**

```json
{
  "name": "Homepage Load Test",
  "description": "Test that the homepage loads correctly",
  "url": "https://example.com",
  "prompt": "Navigate to the homepage and verify it loads correctly"
}
```

**YAML format (.obs1.yaml):**

```yaml
name: "Homepage Load Test"
description: "Test that the homepage loads correctly"
url: "https://example.com"
prompt: "Navigate to the homepage and verify it loads correctly"
```

All formats support optional fields like `schedule`, `assertions`, and `config`.

### Environment Variables

- `OBS1_API_KEY` - Your API key (optional, can also use `obs1 login`)
- `OBS1_VERBOSE` - Enable verbose output
- `OBS1_JSON_OUTPUT` - Enable JSON output

## Output Formats

### Console Output (Default)

Colorized, human-readable output with status indicators and progress bars.

### JSON Output

Machine-readable JSON format for integration with other tools:

```bash
obs1 list --format json
obs1 ai-check my-test --json
```

### JUnit XML

Generate JUnit-compatible XML reports for CI/CD integration:

```bash
obs1 ai-check my-test --reporter junit --output results.xml
```

## CI/CD Integration

### GitHub Actions

```yaml
name: obs1 Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install -g obs1
      - run: obs1 login --api-key ${{ secrets.obs1_API_KEY }}
      - run: obs1 ai-check my-test --reporter junit --output results.xml
      - uses: dorny/test-reporter@v1
        if: always()
        with:
          name: obs1 Test Results
          path: results.xml
          reporter: java-junit
```

### Jenkins

```groovy
pipeline {
    agent any
    stages {
        stage('Test') {
            steps {
                sh 'npm install -g obs1'
                sh 'obs1 login --api-key ${OBS1_API_KEY}'
                sh 'obs1 ai-check my-test --reporter junit --output results.xml'
            }
        }
    }
    post {
        always {
            junit 'results.xml'
        }
    }
}
```

## Advanced Usage

### Development Workflow

For file watching during development, consider using IDE extensions or external tools like `nodemon` or `chokidar`.

### Ad-hoc Testing

Run tests without saving to the database:

```bash
obs1 ai-check --url https://example.com --prompt "Click the login button" --name "Login Test"
```

### Batch Testing

Run multiple tests in sequence:

```bash
obs1 ai-check test1 test2 test3
```

### Custom Timeouts

Set custom timeouts for long-running tests:

```bash
obs1 ai-check my-test --timeout 600000  # 10 minutes
```

## Troubleshooting

### Authentication Issues

```bash
# Check if you're authenticated
obs1 list

# Re-authenticate
obs1 login
```

### Network Issues

```bash
# Check API connectivity
obs1 list --verbose

# If you need a custom API URL, contact support
```

### Test Execution Issues

```bash
# Run with verbose output
obs1 ai-check my-test --verbose

# The ai-check command automatically waits for completion
# No manual status checking needed
```

## Examples

### Basic Test Execution

```bash
# List available tests
obs1 list

# Run a specific test
obs1 ai-check "Login Test"

# Run multiple tests
obs1 ai-check "Login Test" "Checkout Test"
```

### Ad-hoc Testing

```bash
# Test a specific URL with custom instructions
obs1 ai-check --url https://example.com --prompt "Navigate to the contact page and fill out the form"
```

### CI/CD Pipeline

```bash
# Run tests and generate JUnit report
obs1 ai-check my-test --reporter junit --output test-results.xml

# Exit with appropriate code for CI
if [ $? -eq 0 ]; then
  echo "All tests passed"
else
  echo "Some tests failed"
  exit 1
fi
```

### Development Workflow

```bash
# Login (automatically sets up project config)
obs1 login

# Run specific tests before commit
obs1 ai-check critical-tests

# For file watching, use IDE extensions or external tools
```

## API Reference

The CLI integrates with the ObserveOne REST API:

- **Authentication**: Bearer token authentication
- **Base URL**: <https://api.observeone.com> (production)
- **Endpoints**:
  - `GET /api/browser-checks` - List tests
  - `POST /api/browser-checks` - Create test
  - `PUT /api/browser-checks/:id` - Update test
  - `DELETE /api/browser-checks/:id` - Delete test
  - `POST /api/browser-checks/:id/execute` - Execute test
  - `GET /api/browser-checks/execution/:id` - Get execution status
  - `GET /api/browser-checks/executions/:id` - Get execution results
  - `POST /api/browser-checks/execute-adhoc` - Execute ad-hoc test
  - `POST /api/browser-checks/cancel` - Cancel test
  - `POST /api/api-keys/validate` - Validate API key

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

- **Documentation**: <https://docs.obs1.com>
- **Issues**: <https://github.com/obs1/obs1/issues>
- **Discord**: <https://discord.gg/obs1>
