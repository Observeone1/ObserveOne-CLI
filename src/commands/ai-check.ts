import { Command, OptionValues } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { IConfigService } from '../interfaces/config.interface.js';
import { IApiClient } from '../interfaces/api-client.interface.js';
import { IOutputService } from '../interfaces/output.interface.js';
import { SSEClient } from '../services/sse-client.service.js';
import { TestResult } from '../types/index.js';
import { writeFileSync } from 'fs';

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
    .action(async (testNames, options: OptionValues) => {
      if (process.env.OBS_JSON_OUTPUT === 'true' || options.json) {
        outputService.enableJsonMode();
      }
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
          await runAdhocTest(apiClient, configService, options, timeout, results);
        } else {
          await runNamedTests(apiClient, configService, testNames, options, timeout, results);
        }

        await formatAndOutputResults(results, options, outputService);
      } catch (error: any) {
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
    .action(async (options: OptionValues) => {
      if (process.env.OBS_JSON_OUTPUT === 'true' || options.format === 'json' || options.json) {
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

        if (process.env.OBS_JSON_OUTPUT === 'true' || options.format === 'json' || options.json) {
          outputService.formatJsonOutput(tests);
        } else {
          outputService.formatTestList(tests, process.env.OBS_VERBOSE === 'true');
        }
      } catch (error: any) {
        outputService.error(outputService.formatError(error));
        process.exit(1);
      }
    });

  // GET
  aiCheck
    .command('get <id>')
    .description('Get details of an AI browser check')
    .option('-j, --json', 'Output in JSON format')
    .action(async (id, options: OptionValues) => {
      if (process.env.OBS_JSON_OUTPUT === 'true' || options.json) {
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
      } catch (error: any) {
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
    .action(async (options) => {
      if (process.env.OBS_JSON_OUTPUT === 'true' || options.json) {
        outputService.enableJsonMode();
      }
      try {
        const apiKey = configService.getApiKey();
        if (!apiKey) {
          outputService.error('Not authenticated. Please run "obs login" first.');
          process.exit(1);
        }

        let { name, url, prompt } = options;

        if (!name || !url || !prompt) {
          const answers = await inquirer.prompt([
            {
              type: 'input',
              name: 'name',
              message: 'Check name:',
              when: !name,
              validate: (val) => (val.trim() ? true : 'Name is required'),
            },
            {
              type: 'input',
              name: 'url',
              message: 'URL to test:',
              when: !url,
              validate: (val) => {
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
              validate: (val) => (val.trim() ? true : 'Prompt is required'),
            },
          ]);
          name = name || answers.name;
          url = url || answers.url;
          prompt = prompt || answers.prompt;
        }

        outputService.progress('Creating AI browser check...');
        const newTest = await apiClient.createTest({
          name,
          url,
          prompt,
          description: 'Created via CLI',
        });

        if (process.env.OBS_JSON_OUTPUT === 'true') {
          outputService.formatJsonOutput(newTest);
        } else {
          outputService.success(`AI browser check "${name}" created! (ID: ${newTest.id})`);
        }
      } catch (error: any) {
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
    .action(async (id, options) => {
      if (process.env.OBS_JSON_OUTPUT === 'true' || options.json) {
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
          const { confirm } = await inquirer.prompt([
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
      } catch (error: any) {
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
  configService: IConfigService,
  options: OptionValues,
  timeout: number,
  results: TestResult[]
): Promise<void> {
  const isJson = process.env.OBS_JSON_OUTPUT === 'true';
  const spinner = isJson
    ? { start: () => {}, succeed: () => {}, fail: () => {} }
    : ora('Running ad-hoc test...').start();

  try {
    const result = await apiClient.executeAdhocTest({
      name: options.name || 'Ad-hoc Test',
      url: options.url,
      prompt: options.prompt,
      description: options.description,
    });

    results.push(result);
    spinner.succeed('Ad-hoc test started');

    // Use SSE streaming for live progress
    if (result.task_id) {
      await streamTestProgress(
        configService,
        result,
        options.name || 'Ad-hoc Test',
        options,
        timeout,
        results
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
  configService: IConfigService,
  testNames: string[],
  options: OptionValues,
  timeout: number,
  results: TestResult[]
): Promise<void> {
  const isJson = process.env.OBS_JSON_OUTPUT === 'true';
  const spinner = isJson
    ? { start: () => {}, succeed: () => {}, fail: () => {} }
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
        ? { start: () => {}, succeed: () => {}, fail: () => {} }
        : ora(`Running test: ${test.name}`).start();

      try {
        const result = await apiClient.executeTest(test.id);
        results.push(result);
        testSpinner.succeed(`Test "${test.name}" started`);

        // Use SSE streaming for live progress
        if (result.task_id) {
          await streamTestProgress(
            configService,
            result,
            test.name,
            options,
            timeout,
            results,
            testNames
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
  options: any,
  timeout: number,
  results: TestResult[],
  testNames?: string[]
): Promise<void> {
  const sseClient = new SSEClient(configService);
  const { LiveProgressRenderer } = await import('../utils/live-progress.js');
  const { LogWriter } = await import('../utils/log-writer.js');

  // Check if verbose flag was passed
  const isVerbose =
    options.verbose ||
    (testNames && (testNames.includes('--verbose') || testNames.includes('-v'))) ||
    process.env.OBS_VERBOSE === 'true';

  const renderer = new LiveProgressRenderer({
    verbose: isVerbose,
  });
  const logger = new LogWriter(result.task_id!);

  renderer.start(testName);

  // Track completion
  let completed = false;
  let stepCounter = 0;

  // Connect to SSE stream
  sseClient.connect(
    result.task_id!,
    (message) => {
      if (message.type === 'step_update' && message.step) {
        stepCounter++;
        const step = message.step;

        if (message.screenshot) {
          renderer.addScreenshot();
          logger.writeScreenshot(stepCounter);
        }

        renderer.updateStep(stepCounter, step.next_goal || 'Processing...', step);
        logger.writeStep(step);
      } else if (message.type === 'screenshot') {
        renderer.addScreenshot();
        logger.writeScreenshot(stepCounter);
      } else if (message.type === 'complete' || message.type === 'task_completed') {
        const status = message.status === 'failed' ? 'failed' : 'success';
        renderer.complete(status, message.message);
        logger.writeComplete(status, message.message);

        // Calculate duration
        const duration = Date.now() - renderer.getStartTime();

        results[results.length - 1] = {
          ...result,
          status: (status === 'success' ? 'SUCCESS' : 'FAILED') as 'SUCCESS' | 'FAILED',
          message: message.message || result.message,
          duration: duration,
        };

        completed = true;
        sseClient.close();
        logger.close();
        console.log(chalk.gray(`\nDetailed logs: ${logger.getPath()}`));
      } else if (message.type === 'error') {
        renderer.error(message.message || 'Test failed');
        logger.writeComplete('failed', message.message);

        results[results.length - 1] = {
          ...result,
          status: 'FAILED' as const,
          message: message.message || 'Test execution error',
        };

        completed = true;
        sseClient.close();
        logger.close();
      }
    },
    (error) => {
      if (!completed) {
        renderer.error(`Connection error: ${error.message}`);
        logger.writeComplete('failed', `Connection error: ${error.message}`);
        sseClient.close();
        logger.close();
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
        renderer.error('Test execution timed out');
        sseClient.close();
        logger.close();
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
  options: any,
  outputService: IOutputService
): Promise<void> {
  if (options.reporter === 'json' || process.env.OBS_JSON_OUTPUT === 'true') {
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
        console.log(chalk.bold(`\n📊 Test ${index + 1} Results:`));
      }
      outputService.formatTestResult(result);
    });

    // Summary
    const successCount = results.filter((r) => r.status === 'SUCCESS').length;
    const totalCount = results.length;

    console.log(chalk.bold('\n📈 Summary:'));
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
    time: results.reduce((total, r) => total + (r.duration || 0), 0) / 1000,
    testCases: results.map((result, index) => ({
      name: `Test ${index + 1}`,
      classname: 'observeone.test',
      time: (result.duration || 0) / 1000,
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
