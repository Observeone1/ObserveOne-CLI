import 'dotenv/config'; // Load environment variables

// Check for --ci flag to disable colors for cleaner CI logs
if (process.argv.includes('--ci')) {
  process.env.FORCE_COLOR = '0';
}

import { readdirSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';
import chalk from 'chalk';
import { runCLI } from './lib/test-runner.js';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

async function runTests(): Promise<void> {
  const isCI = process.argv.includes('--ci');

  if (isCI) {
    console.log('Running E2E Tests in CI mode...');
  } else {
    console.log(chalk.cyan.bold('\n🧪 Running E2E Tests\n'));
  }

  // Handle Authentication Bootstrapping
  let apiKey = process.env.OBS_API_KEY || process.env.API_KEY;
  let didBootstrapAuth = false;

  if (!apiKey && process.env.OBS_EMAIL && process.env.OBS_PASSWORD) {
    console.log(chalk.yellow('No API Key found. Attempting headless login with provided credentials...'));
    const loginResult = await runCLI(['login', '--headless', '--json']);
    if (loginResult.exitCode === 0) {
      console.log(chalk.green('✓ Successfully authenticated and provisioned API key.'));
      didBootstrapAuth = true;
      // We don't need to set the API key in process.env because it's now stored in the CLI's local config
    } else {
      console.log(chalk.red(`✗ Headless login failed: ${loginResult.stderr || loginResult.stdout}`));
      process.exit(1);
    }
  }

  // Display binary mode being used
  const binaryMode = process.env.OBS_BINARY_MODE || 'local';
  const modeDescriptions: Record<string, string> = {
    local: 'local build (dist/index.js)',
    npx: 'npx observeone-cli',
    global: 'globally installed obs',
  };
  const modeDesc = modeDescriptions[binaryMode] || `custom (${binaryMode})`;
  console.log(chalk.gray(`Binary mode: ${chalk.white(binaryMode)} - ${modeDesc}`));

  // Display test configuration
  const apiUrl = process.env.API_URL || process.env.OBS_API_URL || '(not set)';
  const displayApiKey = apiKey || (didBootstrapAuth ? '(Bootstrapped securely)' : '(not set)');
  const maskedApiKey = displayApiKey.startsWith('obs_') 
    ? `${displayApiKey.slice(0, 8)}***${displayApiKey.slice(-4)}` 
    : displayApiKey;

  console.log(chalk.gray(`API URL: ${chalk.white(apiUrl)}`));
  console.log(chalk.gray(`API Key: ${chalk.white(maskedApiKey)}\n`));

  const testsDir = join(process.cwd(), 'e2e', 'tests');
  const testFiles = readdirSync(testsDir).filter((f) => f.endsWith('.test.ts'));

  const results: TestResult[] = [];
  let totalTests = 0;
  let passedTests = 0;
  const startTime = Date.now();

  for (const file of testFiles) {
    console.log(chalk.gray(`\n ${file}\n`));

    const testPath = join(testsDir, file);
    const testModule = await import(pathToFileURL(testPath).href);

    // Find all exported test functions
    const testFunctions = Object.entries(testModule).filter(
      ([key]) => key.startsWith('test') && typeof testModule[key] === 'function'
    );

    for (const [name, testFn] of testFunctions) {
      totalTests++;
      const start = Date.now();

      try {
        await (testFn as Function)();
        const duration = Date.now() - start;
        results.push({ name, passed: true, duration });
        passedTests++;
        console.log(chalk.green(`    ✓ ${name.replace(/([A-Z])/g, ' $1').trim()} (${duration}ms)`));
      } catch (error: any) {
        const duration = Date.now() - start;
        results.push({
          name,
          passed: false,
          error: error.message,
          duration,
        });
        console.log(chalk.red(`    ✗ ${name.replace(/([A-Z])/g, ' $1').trim()} (${duration}ms)`));
        if (error.message) {
          console.log(chalk.gray(`      ${error.message}`));
        }
      }
    }
  }

  const totalTime = Date.now() - startTime;

  // Summary
  console.log(chalk.bold('\n\n Summary\n'));
  console.log(chalk.gray('─'.repeat(50)));

  if (results.some((r) => !r.passed)) {
    console.log(chalk.red.bold('  ❌ Failed Tests'));
    console.log(chalk.gray('  ─'.repeat(25)));
    const failedTests = results.filter((r) => !r.passed);
    for (const result of failedTests) {
      console.log(chalk.red(`  ✗ ${result.name}`));
      console.log(chalk.gray(`    ${result.error}`));
    }
    console.log(chalk.gray('  ─'.repeat(25)));
  }

  console.log(`  Total: ${totalTests}`);
  console.log(chalk.green(`  Passed: ${passedTests}`));
  console.log(chalk.red(`  Failed: ${totalTests - passedTests}`));
  console.log(chalk.blue(`  Time: ${totalTime}ms`));

  // Cleanup Bootstrapped Auth
  if (didBootstrapAuth) {
    console.log(chalk.yellow('\n🧹 Cleaning up bootstrapped authentication...'));
    await runCLI(['logout']);
  }

  if (passedTests === totalTests) {
    console.log(chalk.green.bold('\n  ✅ All tests passed!\n'));
    process.exit(0);
  } else {
    console.log(chalk.red.bold('\n  ❌ Some tests failed\n'));
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error(chalk.red('Error running tests:'), error);
  process.exit(1);
});
