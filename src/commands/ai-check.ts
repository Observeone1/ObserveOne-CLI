import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { ConfigManager } from "../utils/config.js";
import { ApiClient } from "../utils/api-client.js";
import { OutputFormatter } from "../utils/output.js";
import { TestResult } from "../types/index.js";

export const aiCheckCommand = new Command("ai-check")
  .description("Run AI-powered tests")
  .argument("[test-names...]", "Test names to run (by name or ID)")
  .option("-u, --url <url>", "URL to test")
  .option("-p, --prompt <prompt>", "Test prompt/instructions")
  .option("-n, --name <name>", "Test name")
  .option("-d, --description <description>", "Test description")
  .option("-t, --timeout <timeout>", "Timeout in milliseconds", "300000")
  .option("-w, --wait", "Wait for test completion")
  .option("--adhoc", "Run as ad-hoc test (don't save to database)")
  .option(
    "--reporter <reporter>",
    "Output reporter (console, junit, json)",
    "console"
  )
  .option("-o, --output <file>", "Output file for reports")
  .action(async (testNames, options) => {
    try {
      const apiKey = ConfigManager.getApiKey();
      if (!apiKey) {
        OutputFormatter.error(
          'Not authenticated. Please run "obs1 login" first.'
        );
        process.exit(1);
      }

      const apiClient = new ApiClient();
      const timeout = parseInt(options.timeout);
      const results: TestResult[] = [];

      // If no test names provided, check for ad-hoc options
      if (testNames.length === 0) {
        if (!options.url || !options.prompt) {
          OutputFormatter.error(
            "Either provide test names or use --url and --prompt for ad-hoc testing"
          );
          process.exit(1);
        }

        // Run ad-hoc test
        const spinner = ora("Running ad-hoc test...").start();

        try {
          const result = await apiClient.executeAdhocTest({
            name: options.name || "Ad-hoc Test",
            url: options.url,
            prompt: options.prompt,
            description: options.description,
          });

          results.push(result);
          spinner.succeed("Ad-hoc test completed");
        } catch (error) {
          spinner.fail("Ad-hoc test failed");
          throw error;
        }
      } else {
        // Run named tests
        const spinner = ora("Fetching test details...").start();

        try {
          const tests = await apiClient.getTests();
          const testsToRun = testNames.map((name: string) => {
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
            const testSpinner = ora(`Running test: ${test.name}`).start();

            try {
              const result = await apiClient.executeTest(test.id);
              results.push(result);
              testSpinner.succeed(`Test "${test.name}" started`);

              // Always wait for completion (remove the if condition)
              if (result.executionId) {
                const waitSpinner = ora(
                  "Waiting for test completion..."
                ).start();
                try {
                  const execution = await apiClient.pollExecutionStatus(
                    result.executionId,
                    Math.floor(timeout / 5000),
                    5000
                  );
                  waitSpinner.succeed(
                    `Test "${test.name}" completed with status: ${execution.status}`
                  );

                  // Update result with final status
                  const finalResult = {
                    ...result,
                    status: execution.status as "SUCCESS" | "FAILED",
                    message: execution.error_message || result.message,
                  };
                  results[results.length - 1] = finalResult;
                } catch (error) {
                  waitSpinner.fail(`Test "${test.name}" timed out or failed`);
                  throw error;
                }
              }
            } catch (error) {
              testSpinner.fail(`Test "${test.name}" failed`);
              throw error;
            }
          }
        } catch (error) {
          spinner.fail("Failed to fetch tests");
          throw error;
        }
      }

      // Format and output results
      if (
        options.reporter === "json" ||
        process.env.OBS1_JSON_OUTPUT === "true"
      ) {
        OutputFormatter.formatJsonOutput(results);
      } else if (options.reporter === "junit") {
        const junitReport = generateJUnitReport(results);
        if (options.output) {
          require("fs").writeFileSync(options.output, junitReport);
          OutputFormatter.success(`JUnit report saved to ${options.output}`);
        } else {
          console.log(junitReport);
        }
      } else {
        // Console output
        results.forEach((result, index) => {
          if (results.length > 1) {
            console.log(chalk.bold(`\n📊 Test ${index + 1} Results:`));
          }
          OutputFormatter.formatTestResult(result);
        });

        // Summary
        const successCount = results.filter(
          (r) => r.status === "SUCCESS"
        ).length;
        const totalCount = results.length;

        console.log(chalk.bold("\n📈 Summary:"));
        console.log(chalk.gray("─".repeat(30)));
        console.log(`Total: ${totalCount}`);
        console.log(chalk.green(`Passed: ${successCount}`));
        console.log(chalk.red(`Failed: ${totalCount - successCount}`));

        // Exit with appropriate code
        if (successCount === totalCount) {
          OutputFormatter.success("All tests passed!");
          process.exit(0);
        } else {
          OutputFormatter.error(`${totalCount - successCount} test(s) failed`);
          process.exit(1);
        }
      }
    } catch (error: any) {
      OutputFormatter.error(OutputFormatter.formatError(error));
      process.exit(1);
    }
  });

function generateJUnitReport(results: TestResult[]): string {
  const testSuite = {
    name: "ObserveOne Tests",
    tests: results.length,
    failures: results.filter((r) => r.status === "FAILED").length,
    errors: 0,
    time: results.reduce((total, r) => total + (r.duration || 0), 0) / 1000,
    testCases: results.map((result, index) => ({
      name: `Test ${index + 1}`,
      classname: "observeone.test",
      time: (result.duration || 0) / 1000,
      status: result.status === "SUCCESS" ? "passed" : "failed",
      failure:
        result.status === "FAILED"
          ? {
              message: result.message,
              type: "TestFailure",
              stackTrace: "",
            }
          : undefined,
    })),
  };

  return OutputFormatter.formatJUnitReport(testSuite);
}
