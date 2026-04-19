import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { IConfigService } from '../interfaces/config.interface.js';
import { IApiClient } from '../interfaces/api-client.interface.js';
import { IOutputService } from '../interfaces/output.interface.js';
import { SSEClient } from '../services/sse-client.service.js';
import { TestResult } from '../types/index.js';
import { writeFileSync } from 'fs';

interface AiCheckRunOptions {
  url?: string;
  prompt?: string;
  name?: string;
  description?: string;
  timeout: string;
  verbose?: boolean;
  wait?: boolean;
  adhoc?: boolean;
  reporter: string;
  output?: string;
  apiUrl?: string;
  apiKey?: string;
  json?: boolean;
}

function isJsonOutputMode(options: AiCheckRunOptions): boolean {
  return (
    process.env.OBS_JSON_OUTPUT === 'true' || options.json === true || options.reporter === 'json'
  );
}

/**
 * Factory function to create ai-check command with direct service injection
 */
export function createAiCheckCommand(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService
): Command {
  const aiCheck = new Command('ai-check').description('Manage and run AI-powered tests');

  // RUN (Default)
  aiCheck
    .command('run', { isDefault: true })
    .description('Run AI-powered tests')
    .argument('[test-names...]', 'Test names to run (by name or ID)')
    .option('-u, --url <url>', 'URL to test')
    .option('-p, --prompt <prompt>', 'Test prompt/instructions')
    .option('-n, --name <name>', 'Test name')
    .option('-d, --description <description>', 'Test description')
    .option('-t, --timeout <timeout>', 'Timeout in milliseconds', '300000')
    .option('-v, --verbose', 'Show detailed step information during execution')
    .option('-w, --wait', 'Wait for test completion')
    .option('--adhoc', "Run as ad-hoc test (don't save to database)")
    .option('--reporter <reporter>', 'Output reporter (console, junit, json)', 'console')
    .option('-o, --output <file>', 'Output file for reports')
    .option('--api-url <url>', 'Override API URL')
    .option('--api-key <key>', 'Override API key')
    .option('-j, --json', 'Output in JSON format')
    .action(async (testNames: string[], options: AiCheckRunOptions) => {
      const isJson = isJsonOutputMode(options);
      if (isJson) {
        outputService.enableJsonMode();
      }
      const shouldWait = isJson ? options.wait === true : true;
      try {
        if (options.apiUrl) configService.setCommandLineApiUrl(options.apiUrl);
        if (options.apiKey) configService.setApiKey(options.apiKey);

        const apiKey = configService.getApiKey();
        if (!apiKey) {
          outputService.error('Not authenticated. Please run "obs login" first.');
          process.exit(1);
        }

        const timeout = parseInt(options.timeout);
        const results: TestResult[] = [];

        if (testNames.length === 0) {
          if (!options.url || !options.prompt) {
            outputService.error(
              'Either provide test names or use --url and --prompt for ad-hoc testing'
            );
            process.exit(1);
          }
          await runAdhocTest(
            apiClient,
            outputService,
            configService,
            options,
            timeout,
            results,
            shouldWait,
            isJson
          );
        } else {
          await runNamedTests(
            apiClient,
            outputService,
            configService,
            testNames,
            options,
            timeout,
            results,
            shouldWait,
            isJson
          );
        }

        await formatAndOutputResults(results, options, outputService, isJson);
      } catch (error: unknown) {
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });

  // LIST
  aiCheck
    .command('list')
    .description('List all AI browser checks')
    .option('-f, --format <format>', 'Output format (table, json)', 'table')
    .option('-j, --json', 'Output in JSON format')
    .action(async (options: Record<string, unknown>) => {
      if (
        process.env.OBS_JSON_OUTPUT === 'true' ||
        options.format === 'json' ||
        options.json === true
      ) {
        outputService.enableJsonMode();
      }
      try {
        const apiKey = configService.getApiKey();
        if (!apiKey) {
          outputService.error('Not authenticated. Please run "obs login" first.');
          process.exit(1);
        }

        outputService.progress('Fetching AI checks...');
        const tests = await apiClient.getTests();

        if (
          process.env.OBS_JSON_OUTPUT === 'true' ||
          options.format === 'json' ||
          options.json === true
        ) {
          outputService.formatJsonOutput(tests);
        } else {
          outputService.formatTestList(tests, process.env.OBS_VERBOSE === 'true');
        }
      } catch (error: unknown) {
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });

  // GET
  aiCheck
    .command('get <id>')
    .description('Get details of an AI browser check')
    .option('-j, --json', 'Output in JSON format')
    .action(async (id: string, options: Record<string, unknown>) => {
      if (process.env.OBS_JSON_OUTPUT === 'true' || options.json === true) {
        outputService.enableJsonMode();
      }
      try {
        const apiKey = configService.getApiKey();
        if (!apiKey) {
          outputService.error('Not authenticated. Please run "obs login" first.');
          process.exit(1);
        }

        const testId = parseInt(id);
        if (isNaN(testId)) {
          outputService.error('Invalid test ID.');
          process.exit(1);
        }

        outputService.progress(`Fetching AI check ${testId}...`);
        const testData = await apiClient.getTest(testId);

        if (process.env.OBS_JSON_OUTPUT === 'true') {
          outputService.formatJsonOutput(testData);
        } else {
          outputService.formatTestList([testData], true);
        }
      } catch (error: unknown) {
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });

  // CREATE
  aiCheck
    .command('create')
    .description('Create a new AI browser check')
    .option('-n, --name <name>', 'Test name')
    .option('-u, --url <url>', 'URL to test')
    .option('-p, --prompt <prompt>', 'Test prompt')
    .option('-j, --json', 'Output in JSON format')
    .action(async (options: Record<string, unknown>) => {
      if (process.env.OBS_JSON_OUTPUT === 'true' || options.json === true) {
        outputService.enableJsonMode();
      }
      try {
        const apiKey = configService.getApiKey();
        if (!apiKey) {
          outputService.error('Not authenticated. Please run "obs login" first.');
          process.exit(1);
        }

        let name = options.name as string | undefined;
        let url = options.url as string | undefined;
        let prompt = options.prompt as string | undefined;

        if (!name || !url || !prompt) {
          const answers = await inquirer.prompt<{ name: string; url: string; prompt: string }>([
            {
              type: 'input',
              name: 'name',
              message: 'Check name:',
              when: !name,
              validate: (val: string) => (val.trim() ? true : 'Name is required'),
            },
            {
              type: 'input',
              name: 'url',
              message: 'URL to test:',
              when: !url,
              validate: (val: string) => {
                try {
                  new URL(val);
                  return true;
                } catch {
                  return 'Invalid URL';
                }
              },
            },
            {
              type: 'input',
              name: 'prompt',
              message: 'What should the AI check? (prompt):',
              when: !prompt,
              validate: (val: string) => (val.trim() ? true : 'Prompt is required'),
            },
          ]);
          name = name || answers.name;
          url = url || answers.url;
          prompt = prompt || answers.prompt;
        }

        outputService.progress('Creating AI browser check...');
        const newTest = await apiClient.createTest({
          name: name!,
          url: url!,
          prompt: prompt!,
          description: 'Created via CLI',
        });

        if (process.env.OBS_JSON_OUTPUT === 'true') {
          outputService.formatJsonOutput(newTest);
        } else {
          outputService.success(`AI browser check "${name}" created! (ID: ${newTest.id})`);
        }
      } catch (error: unknown) {
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });

  // DELETE
  aiCheck
    .command('delete <id>')
    .description('Delete an AI browser check')
    .option('-y, --yes', 'Skip confirmation prompt')
    .option('-j, --json', 'Output in JSON format')
    .action(async (id: string, options: Record<string, unknown>) => {
      if (process.env.OBS_JSON_OUTPUT === 'true' || options.json === true) {
        outputService.enableJsonMode();
      }
      try {
        const apiKey = configService.getApiKey();
        if (!apiKey) {
          outputService.error('Not authenticated. Please run "obs login" first.');
          process.exit(1);
        }

        const testId = parseInt(id);
        if (isNaN(testId)) {
          outputService.error('Invalid test ID.');
          process.exit(1);
        }

        if (!options.yes) {
          const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
            {
              type: 'confirm',
              name: 'confirm',
              message: `Are you sure you want to delete AI check ${testId}?`,
              default: false,
            },
          ]);
          if (!confirm) return;
        }

        outputService.progress(`Deleting AI check ${testId}...`);
        await apiClient.deleteTest(testId);
        if (process.env.OBS_JSON_OUTPUT === 'true') {
          outputService.formatJsonOutput({ success: true, id: testId });
        } else {
          outputService.success(`AI check ${testId} deleted successfully.`);
        }
      } catch (error: unknown) {
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });

  // STATUS
  aiCheck
    .command('status <execution-id>')
    .description('Get the status of a browser check execution')
    .option('-j, --json', 'Output in JSON format')
    .action(async (executionId: string, options: Record<string, unknown>) => {
      if (process.env.OBS_JSON_OUTPUT === 'true' || options.json === true) {
        outputService.enableJsonMode();
      }
      try {
        const apiKey = configService.getApiKey();
        if (!apiKey) {
          outputService.error('Not authenticated. Please run "obs login" first.');
          process.exit(1);
        }

        const id = parseInt(executionId);
        if (isNaN(id)) {
          outputService.error('Invalid execution ID. Must be a numeric ID from a named check run.');
          process.exit(1);
        }

        outputService.progress(`Fetching execution status for ${id}...`);
        const execution = await apiClient.getExecutionStatus(id);
        outputService.formatJsonOutput(execution);
      } catch (error: unknown) {
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });

  // WAIT
  aiCheck
    .command('wait <execution-id>')
    .description('Wait for a browser check execution to complete')
    .option('-j, --json', 'Output in JSON format')
    .option('-t, --timeout <ms>', 'Max time to wait in milliseconds', '300000')
    .action(async (executionId: string, options: Record<string, unknown>) => {
      const isJson = process.env.OBS_JSON_OUTPUT === 'true' || options.json === true;
      if (isJson) {
        outputService.enableJsonMode();
      }
      try {
        const apiKey = configService.getApiKey();
        if (!apiKey) {
          outputService.error('Not authenticated. Please run "obs login" first.');
          process.exit(1);
        }

        const id = parseInt(executionId);
        if (isNaN(id)) {
          outputService.error('Invalid execution ID. Must be a numeric ID from a named check run.');
          process.exit(1);
        }

        const timeoutMs = parseInt(options.timeout as string) || 300000;
        const intervalMs = 5000;
        const maxAttempts = Math.ceil(timeoutMs / intervalMs);

        const spinner = isJson ? null : ora(`Waiting for execution ${id}...`).start();

        const execution = await apiClient.pollExecutionStatus(id, maxAttempts, intervalMs);

        if (spinner) {
          if (execution.status === 'SUCCESS') {
            spinner.succeed(`Execution ${id} completed successfully.`);
          } else {
            spinner.fail(`Execution ${id} ended with status: ${execution.status}`);
          }
        }

        let results: unknown[] | undefined;
        if (execution.status === 'SUCCESS') {
          try {
            results = await apiClient.getExecutionResults(id);
          } catch {
            // results are optional — don't fail the command if they're unavailable
          }
        }

        const payload = { execution, ...(results !== undefined && { results }) };
        outputService.formatJsonOutput(payload);

        if (execution.status !== 'SUCCESS') {
          process.exit(1);
        }
      } catch (error: unknown) {
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });

  return aiCheck;
}

/**
 * Run an ad-hoc test
 */
async function runAdhocTest(
  apiClient: IApiClient,
  outputService: IOutputService,
  configService: IConfigService,
  options: AiCheckRunOptions,
  timeout: number,
  results: TestResult[],
  shouldWait: boolean,
  isJson: boolean
): Promise<void> {
  const spinner = isJson
    ? { start: () => {}, succeed: (_msg: string) => {}, fail: (_msg: string) => {} }
    : ora('Running ad-hoc test...').start();

  try {
    const result = await apiClient.executeAdhocTest({
      name: options.name || 'Ad-hoc Test',
      url: options.url!,
      prompt: options.prompt!,
      description: options.description,
    });

    results.push(result);
    spinner.succeed('Ad-hoc test started');

    // Use SSE streaming for live progress
    if (result.task_id && shouldWait) {
      await streamTestProgress(
        configService,
        result,
        options.name || 'Ad-hoc Test',
        options,
        timeout,
        results,
        undefined,
        isJson
      );
    }
  } catch (error) {
    spinner.fail('Ad-hoc test failed');
    throw error;
  }
}

/**
 * Run named tests
 */
async function runNamedTests(
  apiClient: IApiClient,
  _outputService: IOutputService,
  configService: IConfigService,
  testNames: string[],
  options: AiCheckRunOptions,
  timeout: number,
  results: TestResult[],
  shouldWait: boolean,
  isJson: boolean
): Promise<void> {
  const spinner = isJson
    ? { start: () => {}, succeed: (_msg: string) => {}, fail: (_msg: string) => {} }
    : ora('Fetching test details...').start();

  try {
    const tests = await apiClient.getTests();
    const testsToRun = testNames
      .filter((name: string) => !name.startsWith('-'))
      .map((name: string) => {
        // Try to find by name first, then by ID
        let test = tests.find((t) => t.name === name);
        if (!test) {
          const id = parseInt(name);
          if (!isNaN(id)) {
            test = tests.find((t) => t.id === id);
          }
        }
        if (!test) {
          throw new Error(`Test "${name}" not found`);
        }
        return test;
      });

    spinner.succeed(`Found ${testsToRun.length} test(s) to run`);

    // Execute each test
    for (const test of testsToRun) {
      const testSpinner = isJson
        ? { start: () => {}, succeed: (_msg: string) => {}, fail: (_msg: string) => {} }
        : ora(`Running test: ${test.name}`).start();

      try {
        const result = await apiClient.executeTest(test.id);
        results.push(result);
        testSpinner.succeed(`Test "${test.name}" started`);

        // Use SSE streaming for live progress
        if (result.task_id && shouldWait) {
          await streamTestProgress(
            configService,
            result,
            test.name,
            options,
            timeout,
            results,
            testNames,
            isJson
          );
        }
      } catch (error) {
        testSpinner.fail(`Test "${test.name}" failed`);
        throw error;
      }
    }
  } catch (error) {
    spinner.fail('Failed to fetch tests');
    throw error;
  }
}

/**
 * Stream test progress using SSE
 */
async function streamTestProgress(
  configService: IConfigService,
  result: TestResult,
  testName: string,
  options: AiCheckRunOptions,
  timeout: number,
  results: TestResult[],
  testNames?: string[],
  silent: boolean = false
): Promise<void> {
  const sseClient = new SSEClient(configService);
  const startTime = Date.now();

  interface Step {
    next_goal?: string;
    [key: string]: unknown;
  }

  interface Renderer {
    start: (name: string) => void;
    addScreenshot: () => void;
    updateStep: (counter: number, msg: string, step: Step) => void;
    complete: (status: string, msg?: string) => void;
    error: (msg: string) => void;
  }

  interface Logger {
    writeScreenshot: (counter: number) => void;
    writeStep: (step: Step) => void;
    writeComplete: (status: string, msg?: string) => void;
    close: () => void;
    getPath: () => string;
  }

  let renderer: Renderer | null = null;
  let logger: Logger | null = null;

  // Check if verbose flag was passed
  const isVerbose =
    options.verbose ||
    (testNames && (testNames.includes('--verbose') || testNames.includes('-v'))) ||
    process.env.OBS_VERBOSE === 'true';

  if (!silent) {
    const { LiveProgressRenderer } = await import('../utils/live-progress.js');
    const { LogWriter } = await import('../utils/log-writer.js');
    renderer = new LiveProgressRenderer({
      verbose: isVerbose,
    }) as unknown as Renderer;
    logger = new LogWriter(result.task_id!) as unknown as Logger;
    renderer.start(testName);
  }

  // Track completion
  let completed = false;
  let stepCounter = 0;

  // Connect to SSE stream
  sseClient.connect(
    result.task_id!,
    (message) => {
      if (message.type === 'step_update' && message.step) {
        stepCounter++;
        const step = message.step as Step;

        if (!silent && renderer && logger) {
          if (message.screenshot) {
            renderer.addScreenshot();
            logger.writeScreenshot(stepCounter);
          }

          renderer.updateStep(stepCounter, step.next_goal || 'Processing...', step);
          logger.writeStep(step);
        }
      } else if (message.type === 'screenshot') {
        if (!silent && renderer && logger) {
          renderer.addScreenshot();
          logger.writeScreenshot(stepCounter);
        }
      } else if (message.type === 'complete' || message.type === 'task_completed') {
        const status = message.status === 'failed' ? 'failed' : 'success';
        if (!silent && renderer && logger) {
          renderer.complete(status, message.message);
          logger.writeComplete(status, message.message);
        }

        // Calculate duration
        const duration = Date.now() - startTime;

        results[results.length - 1] = {
          ...result,
          status: (status === 'success' ? 'SUCCESS' : 'FAILED') as 'SUCCESS' | 'FAILED',
          message: message.message || result.message,
          duration: duration,
        };

        completed = true;
        sseClient.close();
        if (!silent && logger) {
          logger.close();
          console.log(chalk.gray(`\nDetailed logs: ${logger.getPath()}`));
        }
      } else if (message.type === 'error') {
        if (!silent && renderer && logger) {
          renderer.error(message.message || 'Test failed');
          logger.writeComplete('failed', message.message);
        }

        results[results.length - 1] = {
          ...result,
          status: 'FAILED' as const,
          message: message.message || 'Test execution error',
        };

        completed = true;
        sseClient.close();
        if (!silent && logger) {
          logger.close();
        }
      }
    },
    (error: unknown) => {
      if (!completed) {
        const err = error as { message?: string };
        if (!silent && renderer && logger) {
          renderer.error(`Connection error: ${err.message}`);
          logger.writeComplete('failed', `Connection error: ${err.message}`);
        }
        results[results.length - 1] = {
          ...result,
          status: 'FAILED' as const,
          message: `Connection error: ${err.message}`,
        };
        sseClient.close();
        if (!silent && logger) {
          logger.close();
        }
        completed = true;
      }
    }
  );

  // Wait for completion
  await new Promise<void>((resolve) => {
    const checkInterval = setInterval(() => {
      if (completed) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 100);

    setTimeout(() => {
      if (!completed) {
        clearInterval(checkInterval);
        if (!silent && renderer) {
          renderer.error('Test execution timed out');
        }
        results[results.length - 1] = {
          ...result,
          status: 'FAILED' as const,
          message: 'Test execution timed out',
        };
        sseClient.close();
        if (!silent && logger) {
          logger.close();
        }
        resolve();
      }
    }, timeout);
  });
}

/**
 * Format and output test results
 */
async function formatAndOutputResults(
  results: TestResult[],
  options: AiCheckRunOptions,
  outputService: IOutputService,
  isJson: boolean
): Promise<void> {
  if (isJson) {
    outputService.enableJsonMode();
    outputService.formatJsonOutput(results);
  } else if (options.reporter === 'junit') {
    const junitReport = generateJUnitReport(results, outputService);
    if (options.output) {
      writeFileSync(options.output, junitReport);
      outputService.success(`JUnit report saved to ${options.output}`);
    } else {
      console.log(junitReport);
    }
  } else {
    // Console output
    results.forEach((result, index) => {
      if (results.length > 1) {
        console.log(chalk.bold(`\nTest ${index + 1}:`));
      }
      outputService.formatTestResult(result);
    });

    // Summary
    const successCount = results.filter((r) => r.status === 'SUCCESS').length;
    const totalCount = results.length;

    console.log(chalk.bold('\nSummary'));
    console.log(chalk.gray('─'.repeat(30)));
    console.log(`Total: ${totalCount}`);
    console.log(chalk.green(`Passed: ${successCount}`));
    console.log(chalk.red(`Failed: ${totalCount - successCount}`));

    // Exit with appropriate code
    if (successCount === totalCount) {
      outputService.success('All tests passed!');
      process.exit(0);
    } else {
      outputService.error(`${totalCount - successCount} test(s) failed`);
      process.exit(1);
    }
  }
}

/**
 * Generate JUnit XML report
 */
function generateJUnitReport(results: TestResult[], outputService: IOutputService): string {
  const testSuite = {
    name: 'ObserveOne Tests',
    tests: results.length,
    failures: results.filter((r) => r.status === 'FAILED').length,
    errors: 0,
    time: (results.reduce((total, r) => total + (r.duration || 0), 0) / 1000).toString(),
    testCases: results.map((result, index) => ({
      name: `Test ${index + 1}`,
      classname: 'observeone.test',
      time: ((result.duration || 0) / 1000).toString(),
      status: result.status === 'SUCCESS' ? 'passed' : 'failed',
      failure:
        result.status === 'FAILED'
          ? {
              message: result.message,
              type: 'TestFailure',
              stackTrace: '',
            }
          : undefined,
    })),
  };

  return outputService.formatJUnitReport(testSuite);
}
