# E2E Testing

End-to-end tests for the ObserveOne CLI that run actual CLI commands against a real backend.

## Prerequisites

1. **Local Backend**: Your ObserveOne backend must be running locally
2. **Test API Key**: Create a test API key in your backend
3. **Built CLI**: Run `npm run build` to build the CLI before testing

## Setup

1. Copy the environment template:

   ```bash
   cp e2e/.env.example e2e/.env
   ```

2. Edit `e2e/.env` and add:
   - `API_URL`: Your local backend URL (e.g., `http://localhost:3000`)
   - `OBS1_API_KEY`: A valid API key from your backend
   - `OBS1_BINARY_MODE` (optional): How to run the CLI binary
     - `local` (default): Run local build from `dist/index.js`
     - `npx`: Run published package via `npx observeone-cli`
     - `global`: Run globally installed `obs1` command
     - Custom path: Any other value is used as a command path

3. Build the CLI (only needed for `local` mode):

   ```bash
   npm run build
   ```

## Running Tests

Run all E2E tests (using local build by default):

```bash
npm test
```

### Testing Different Binary Sources

Test the published npm package using npx:

```bash
OBS1_BINARY_MODE=npx npm test
```

Test a globally installed CLI:

```bash
npm install -g observeone-cli
OBS1_BINARY_MODE=global npm test
```

Test with a custom binary path:

```bash
OBS1_BINARY_MODE=/path/to/custom/obs1 npm test
```

## Writing New Tests

1. Create a new file in `e2e/tests/` with the `.test.ts` extension
2. Export test functions that start with `test`:

```typescript
import { runCLI, assertSuccess, assertContains } from '../lib/test-runner.js';

export async function testMyFeature() {
  const result = await runCLI(['my-command', '--arg']);
  assertSuccess(result, 'My command should succeed');
  assertContains(result.stdout, 'Expected output');
}
```

## Available Assertions

- `assertSuccess(result, message)` - Assert exit code is 0
- `assertFailure(result, message)` - Assert non-zero exit code
- `assertContains(output, text, message)` - Assert output contains text
- `assertJSON(output, message)` - Assert output is valid JSON
- `assert(condition, message)` - Generic assertion

## Tips

- By default, tests run against the **built** CLI (`dist/index.js`)
- Use `OBS1_BINARY_MODE=npx` to test the published npm package instead
- Use `OBS1_BINARY_MODE=global` to test a globally installed version
- Rebuild after code changes when testing local build: `npm run build`
- Each test is independent
- Use descriptive test function names (e.g., `testLoginWithInvalidKey`)
- Check both stdout and stderr for error messages
