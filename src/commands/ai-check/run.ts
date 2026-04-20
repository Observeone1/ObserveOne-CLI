import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { IConfigService } from '../../interfaces/config.interface.js';
import { IApiClient } from '../../interfaces/api-client.interface.js';
import { IOutputService } from '../../interfaces/output.interface.js';
import { SSEClient } from '../../services/sse-client.service.js';
import { TestResult } from '../../types/index.js';
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

export function createAiCheckRunCommand(
  configService: IConfigService,
  apiClient: IApiClient,
  outputService: IOutputService
): Command {
  return new Command('run')
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
}

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

    for (const test of testsToRun) {
      const testSpinner = isJson
        ? { start: () => {}, succeed: (_msg: string) => {}, fail: (_msg: string) => {} }
        : ora(`Running test: ${test.name}`).start();

      try {
        const result = await apiClient.executeTest(test.id);
        results.push(result);
        testSpinner.succeed(`Test "${test.name}" started`);

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

  const isVerbose =
    options.verbose ||
    (testNames && (testNames.includes('--verbose') || testNames.includes('-v'))) ||
    process.env.OBS_VERBOSE === 'true';

  if (!silent) {
    const { LiveProgressRenderer } = await import('../../utils/live-progress.js');
    const { LogWriter } = await import('../../utils/log-writer.js');
    renderer = new LiveProgressRenderer({
      verbose: isVerbose,
    }) as unknown as Renderer;
    logger = new LogWriter(result.task_id!) as unknown as Logger;
    renderer.start(testName);
  }

  let completed = false;
  let stepCounter = 0;

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
    results.forEach((result, index) => {
      if (results.length > 1) {
        console.log(chalk.bold(`\nTest ${index + 1}:`));
      }
      outputService.formatTestResult(result);
    });

    const successCount = results.filter((r) => r.status === 'SUCCESS').length;
    const totalCount = results.length;

    console.log(chalk.bold('\nSummary'));
    console.log(chalk.gray('─'.repeat(30)));
    console.log(`Total: ${totalCount}`);
    console.log(chalk.green(`Passed: ${successCount}`));
    console.log(chalk.red(`Failed: ${totalCount - successCount}`));

    if (successCount === totalCount) {
      outputService.success('All tests passed!');
      process.exit(0);
    } else {
      outputService.error(`${totalCount - successCount} test(s) failed`);
      process.exit(1);
    }
  }
}

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
