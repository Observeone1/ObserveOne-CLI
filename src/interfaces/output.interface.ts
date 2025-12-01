import { Test, TestExecution, TestResult } from "../types/index.js";

/**
 * Output formatting service interface
 * Abstracts console output and formatting
 */
export interface IOutputService {
  success(message: string): void;
  error(message: string): void;
  warning(message: string): void;
  info(message: string): void;
  progress(message: string): void;
  formatTestList(tests: Test[], verbose?: boolean): void;
  formatTestExecution(execution: TestExecution): void;
  formatTestResult(result: TestResult): void;
  formatJsonOutput(data: any): void;
  formatJUnitReport(testSuite: any): string;
  formatError(error: any): string;
}
