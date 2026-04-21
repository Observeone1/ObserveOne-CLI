import 'dotenv/config'; // Load environment variables

// Check for --ci flag to disable colors for cleaner CI logs
if (process.argv.includes('--ci')) {
  process.env.FORCE_COLOR = '0';
}

import { readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { pathToFileURL } from 'url';
import chalk from 'chalk';
import { brand } from '../src/utils/theme.js';
import { runCLI } from './lib/test-runner.js';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

interface FileResult {
  file: string;
  results: TestResult[];
}

type TestEvent =
  | { kind: 'file-start'; file: string }
  | { kind: 'file-done'; file: string }
  | { kind: 'file-import-error'; file: string; error: string }
  | { kind: 'test-done'; file: string; result: TestResult };

function formatTestName(name: string): string {
  return name
    .replace(/^test/, '')
    .replace(/([A-Z])/g, ' $1')
    .trim();
}

// --- Live renderer ---
const inProgress = new Set<string>();
let footerLines = 0;
const isCI = process.argv.includes('--ci');

function clearFooter(): void {
  if (footerLines > 0) {
    process.stdout.write(`\x1b[${footerLines}A\x1b[0J`);
    footerLines = 0;
  }
}

function renderFooter(): void {
  if (isCI || inProgress.size === 0) return;
  for (const file of inProgress) {
    process.stdout.write(`${chalk.gray(file.padEnd(32))}${chalk.gray('running...')}\n`);
    footerLines++;
  }
}

function printEvent(ev: TestEvent): void {
  if (isCI) {
    // Simple linear output for CI
    if (ev.kind === 'file-start') {
      process.stdout.write(`${ev.file.padEnd(32)}starting\n`);
    } else if (ev.kind === 'file-import-error') {
      process.stdout.write(`${ev.file.padEnd(32)}✗ import error: ${ev.error}\n`);
    } else if (ev.kind === 'test-done') {
      const { name, passed, duration, error } = ev.result;
      const status = passed ? '✓' : '✗';
      process.stdout.write(
        `${ev.file.padEnd(32)}${status} ${formatTestName(name)} (${duration}ms)\n`
      );
      if (!passed && error) process.stdout.write(`${' '.repeat(32)}${error}\n`);
    }
    return;
  }

  clearFooter();

  if (ev.kind === 'file-start') {
    inProgress.add(ev.file);
  } else if (ev.kind === 'file-done') {
    inProgress.delete(ev.file);
  } else if (ev.kind === 'file-import-error') {
    inProgress.delete(ev.file);
    process.stdout.write(
      `${chalk.gray(ev.file.padEnd(32))}${chalk.red('✗ import error:')} ${ev.error}\n`
    );
  } else if (ev.kind === 'test-done') {
    const { name, passed, duration, error } = ev.result;
    const label = chalk.gray(ev.file.padEnd(32));
    const status = passed ? chalk.green('✓') : chalk.red('✗');
    const testLabel = passed ? chalk.green(formatTestName(name)) : chalk.red(formatTestName(name));
    process.stdout.write(`${label}${status} ${testLabel} ${brand.muted(`(${duration}ms)`)}\n`);
    if (!passed && error) {
      process.stdout.write(`${' '.repeat(32)}${chalk.gray(error)}\n`);
    }
  }

  renderFooter();
}

async function runFile(
  file: string,
  testsDir: string,
  onEvent: (ev: TestEvent) => void,
  testNameFilter?: string
): Promise<FileResult> {
  onEvent({ kind: 'file-start', file });
  const results: TestResult[] = [];

  let testModule: Record<string, unknown>;
  try {
    testModule = await import(pathToFileURL(join(testsDir, file)).href);
  } catch (err: unknown) {
    const msg = (err as Error)?.message || String(err);
    onEvent({ kind: 'file-import-error', file, error: msg });
    return {
      file,
      results: [{ name: `[import] ${file}`, passed: false, error: msg, duration: 0 }],
    };
  }

  const allFunctions = Object.entries(testModule).filter(
    ([key]) => key.startsWith('test') && typeof testModule[key] === 'function'
  );

  const testFunctions = testNameFilter
    ? allFunctions.filter(([key]) => key.toLowerCase().includes(testNameFilter.toLowerCase()))
    : allFunctions;

  for (const [name, testFn] of testFunctions) {
    const start = Date.now();
    try {
      await (testFn as () => Promise<void>)();
      const duration = Date.now() - start;
      const result: TestResult = { name, passed: true, duration };
      results.push(result);
      onEvent({ kind: 'test-done', file, result });
    } catch (error: unknown) {
      const duration = Date.now() - start;
      const msg = (error as Error)?.message || String(error);
      const result: TestResult = { name, passed: false, error: msg, duration };
      results.push(result);
      onEvent({ kind: 'test-done', file, result });
    }
  }

  onEvent({ kind: 'file-done', file });
  return { file, results };
}

async function runWithConcurrency(
  files: string[],
  concurrency: number,
  testsDir: string,
  onEvent: (ev: TestEvent) => void,
  onFileDone: (result: FileResult) => void,
  testNameFilter?: string
): Promise<void> {
  const queue = [...files];

  async function worker() {
    while (queue.length > 0) {
      const file = queue.shift()!;
      const result = await runFile(file, testsDir, onEvent, testNameFilter);
      onFileDone(result);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, worker));
}

async function runTests(): Promise<void> {
  const isList = process.argv.includes('--list');
  const concurrencyArg = process.argv.find((a) => a.startsWith('--concurrency='));
  const concurrency = concurrencyArg ? parseInt(concurrencyArg.split('=')[1], 10) : 4;
  const testArgIdx = process.argv.indexOf('--test');
  const testNameFilter = testArgIdx !== -1 ? process.argv[testArgIdx + 1] : undefined;
  const filters = process.argv.slice(2).filter((a) => !a.startsWith('--'));

  if (isCI) {
    console.log('Running E2E Tests in CI mode...');
  } else {
    console.log(chalk.cyan.bold('\n🧪 Running E2E Tests\n'));
  }

  // Handle Authentication Bootstrapping
  let apiKey = process.env.OBS_API_KEY || process.env.API_KEY;
  let didBootstrapAuth = false;

  if (!apiKey && process.env.OBS_EMAIL && process.env.OBS_PASSWORD) {
    console.log(
      chalk.yellow('No API Key found. Attempting headless login with provided credentials...')
    );
    const loginResult = await runCLI(['login', '--headless', '--json']);
    if (loginResult.exitCode === 0) {
      console.log(chalk.green('✓ Successfully authenticated and provisioned API key.'));
      didBootstrapAuth = true;
    } else {
      console.log(
        chalk.red(`✗ Headless login failed: ${loginResult.stderr || loginResult.stdout}`)
      );
      process.exit(1);
    }
  }

  const binaryMode = process.env.OBS_BINARY_MODE || 'local';
  const modeDescriptions: Record<string, string> = {
    local: 'local build (dist/index.js)',
    npx: 'npx observeone-cli',
    global: 'globally installed obs',
  };
  const modeDesc = modeDescriptions[binaryMode] || `custom (${binaryMode})`;
  console.log(chalk.gray(`Binary mode: ${chalk.white(binaryMode)} - ${modeDesc}`));

  const apiUrl = process.env.API_URL || process.env.OBS_API_URL || '(not set)';
  const displayApiKey = apiKey || (didBootstrapAuth ? '(Bootstrapped securely)' : '(not set)');
  const maskedApiKey = displayApiKey.startsWith('obs_')
    ? `${displayApiKey.slice(0, 8)}***${displayApiKey.slice(-4)}`
    : displayApiKey;

  console.log(chalk.gray(`API URL: ${chalk.white(apiUrl)}`));
  console.log(chalk.gray(`API Key: ${chalk.white(maskedApiKey)}\n`));

  const testsDir = join(process.cwd(), 'e2e', 'tests');

  function collectTestFiles(dir: string): string[] {
    const entries = readdirSync(dir);
    const files: string[] = [];
    for (const entry of entries) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        files.push(...collectTestFiles(full));
      } else if (entry.endsWith('.test.ts')) {
        files.push(relative(testsDir, full));
      }
    }
    return files;
  }

  const allFiles = collectTestFiles(testsDir);
  const testFiles =
    filters.length > 0 ? allFiles.filter((f) => filters.some((p) => f.includes(p))) : allFiles;

  if (isList) {
    for (const file of testFiles) {
      console.log(chalk.white(`\n ${file}`));
      try {
        const testModule = await import(pathToFileURL(join(testsDir, file)).href);
        const names = Object.keys(testModule).filter(
          (k) =>
            k.startsWith('test') &&
            typeof testModule[k] === 'function' &&
            (!testNameFilter || k.toLowerCase().includes(testNameFilter.toLowerCase()))
        );
        for (const name of names) {
          console.log(chalk.gray(`   · ${name}`));
        }
      } catch (err: unknown) {
        console.log(chalk.red(`   ✗ Import error: ${(err as Error)?.message}`));
      }
    }
    console.log('');
    process.exit(0);
  }

  if (filters.length > 0) {
    console.log(
      chalk.gray(`Filter: ${chalk.white(filters.join(', '))} → ${testFiles.length} file(s)\n`)
    );
  }
  if (testNameFilter) {
    console.log(chalk.gray(`Test filter: ${chalk.white(testNameFilter)} (substring match)\n`));
  }
  if (concurrency > 1 && testFiles.length > 1) {
    console.log(chalk.gray(`Concurrency: ${chalk.white(String(concurrency))} parallel files\n`));
  }

  const allResults: TestResult[] = [];
  const startTime = Date.now();

  await runWithConcurrency(testFiles, concurrency, testsDir, printEvent, (fileResult) => {
    allResults.push(...fileResult.results);
  }, testNameFilter);

  const totalTime = Date.now() - startTime;
  const passedTests = allResults.filter((r) => r.passed).length;
  const totalTests = allResults.length;

  console.log(chalk.bold('\n\n Summary\n'));
  console.log(chalk.gray('─'.repeat(50)));

  if (allResults.some((r) => !r.passed)) {
    console.log(chalk.red.bold('  ❌ Failed Tests'));
    console.log(chalk.gray('  ─'.repeat(25)));
    for (const result of allResults.filter((r) => !r.passed)) {
      console.log(chalk.red(`  ✗ ${result.name}`));
      console.log(chalk.gray(`    ${result.error}`));
    }
    console.log(chalk.gray('  ─'.repeat(25)));
  }

  console.log(`  Total: ${totalTests}`);
  console.log(chalk.green(`  Passed: ${passedTests}`));
  console.log(chalk.red(`  Failed: ${totalTests - passedTests}`));
  console.log(brand.muted(`  Time: ${totalTime}ms`));

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
