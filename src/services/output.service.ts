import chalk from "chalk";
import { IOutputService } from "../interfaces/output.interface.js";
import { Test, TestExecution, TestResult } from "../types/index.js";

/**
 * Output formatting service implementation
 * Handles console output and formatting
 */
export class OutputService implements IOutputService {
  success(message: string): void {
    console.log(chalk.green(`✅ ${message}`));
  }

  error(message: string): void {
    console.error(chalk.red(`❌ ${message}`));
  }

  warning(message: string): void {
    console.log(chalk.yellow(`⚠️  ${message}`));
  }

  info(message: string): void {
    console.log(chalk.blue(`ℹ️  ${message}`));
  }

  progress(message: string): void {
    console.log(chalk.cyan(`🔄 ${message}`));
  }

  formatTestList(tests: Test[], verbose: boolean = false): void {
    if (tests.length === 0) {
      this.info("No tests found.");
      return;
    }

    console.log(chalk.bold("\n📋 Available Tests:"));
    console.log(chalk.gray("─".repeat(80)));

    tests.forEach((test, index) => {
      console.log(chalk.bold(`${index + 1}. ${test.name}`));
      if (test.description) {
        console.log(chalk.gray(`   ${test.description}`));
      }
      console.log(chalk.gray(`   URL: ${test.url}`));
      console.log(chalk.gray(`   ID: ${test.id}`));
      console.log(
        chalk.gray(
          `   Created: ${new Date(test.created_at).toLocaleDateString()}`
        )
      );

      if (verbose) {
        // Show additional fields in verbose mode
        if ((test as any).prompt) {
          console.log(chalk.gray(`   Prompt: ${(test as any).prompt}`));
        }
        if ((test as any).status) {
          console.log(chalk.gray(`   Status: ${(test as any).status}`));
        }
        if ((test as any).uptime_percentage !== undefined) {
          console.log(
            chalk.gray(
              `   Uptime: ${(test as any).uptime_percentage.toFixed(2)}%`
            )
          );
        }
        console.log(
          chalk.gray(
            `   Updated: ${new Date(test.updated_at).toLocaleDateString()}`
          )
        );
      }

      console.log("");
    });
  }

  formatTestExecution(execution: TestExecution): void {
    const statusColor = this.getStatusColor(execution.status);
    const statusIcon = this.getStatusIcon(execution.status);

    console.log(chalk.bold("\n📊 Test Execution Status:"));
    console.log(chalk.gray("─".repeat(50)));
    console.log(`Status: ${statusColor(`${statusIcon} ${execution.status}`)}`);
    console.log(`Execution ID: ${execution.id}`);
    console.log(`Test ID: ${execution.test_id}`);
    console.log(`Started: ${new Date(execution.started_at).toLocaleString()}`);

    if (execution.completed_at) {
      console.log(
        `Completed: ${new Date(execution.completed_at).toLocaleString()}`
      );
    }

    if (execution.error_message) {
      console.log(chalk.red(`Error: ${execution.error_message}`));
    }

    if (execution.task_id) {
      console.log(`Task ID: ${execution.task_id}`);
    }
  }

  formatTestResult(result: TestResult): void {
    const statusColor = this.getStatusColor(result.status);
    const statusIcon = this.getStatusIcon(result.status);

    console.log(chalk.bold("\n🎯 Test Result:"));
    console.log(chalk.gray("─".repeat(50)));
    console.log(`Status: ${statusColor(`${statusIcon} ${result.status}`)}`);
    console.log(`Message: ${result.message}`);

    if (result.task_id) {
      console.log(`Task ID: ${result.task_id}`);
    }

    if (result.duration) {
      console.log(`Duration: ${(result.duration / 1000).toFixed(2)}s`);
    }

    if (result.screenshots && result.screenshots.length > 0) {
      console.log(
        chalk.blue(`\n📸 Screenshots: ${result.screenshots.length} captured`)
      );
    }
  }

  formatJsonOutput(data: any): void {
    console.log(JSON.stringify(data, null, 2));
  }

  formatJUnitReport(testSuite: any): string {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="${testSuite.name}" tests="${testSuite.tests}" failures="${
      testSuite.failures
    }" errors="${testSuite.errors}" time="${testSuite.time}">
${testSuite.testCases
  .map((testCase: any) => {
    let xml = `  <testcase name="${testCase.name}" classname="${testCase.classname}" time="${testCase.time}">`;

    if (testCase.status === "failed" && testCase.failure) {
      xml += `\r\n    <failure message="${testCase.failure.message}" type="${
        testCase.failure.type
      }">\r\n${testCase.failure.stackTrace || ""}\r\n    </failure>`;
    } else if (testCase.status === "skipped") {
      xml += `\r\n    <skipped/>`;
    }

    xml += `\r\n  </testcase>`;
    return xml;
  })
  .join("\n")}
</testsuite>`;

    return xml;
  }

  private getStatusColor(status: string): (text: string) => string {
    switch (status.toUpperCase()) {
      case "SUCCESS":
        return chalk.green;
      case "FAILED":
        return chalk.red;
      case "RUNNING":
        return chalk.blue;
      case "PENDING":
        return chalk.yellow;
      case "CANCELLED":
        return chalk.gray;
      default:
        return chalk.white;
    }
  }

  private getStatusIcon(status: string): string {
    switch (status.toUpperCase()) {
      case "SUCCESS":
        return "✅";
      case "FAILED":
        return "❌";
      case "RUNNING":
        return "🔄";
      case "PENDING":
        return "⏳";
      case "CANCELLED":
        return "⏹️";
      default:
        return "❓";
    }
  }

  formatError(error: any): string {
    if (error.response) {
      // API error
      const status = error.response.status;
      const message =
        error.response.data?.error ||
        error.response.data?.message ||
        error.message;
      return `API Error (${status}): ${message}`;
    } else if (error.request) {
      // Network error
      return `Network Error: Unable to connect to API. Please check your internet connection and API URL.`;
    } else {
      // Other error
      return error.message || "An unknown error occurred";
    }
  }
}
