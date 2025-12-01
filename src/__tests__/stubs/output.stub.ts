import { IOutputService } from "../../interfaces/output.interface.js";
import { Test, TestExecution, TestResult } from "../../types/index.js";

/**
 * Create a stub implementation of IOutputService for testing
 */
export function createOutputStub(
  overrides?: Partial<IOutputService>
): IOutputService {
  return {
    success: () => {},
    error: () => {},
    warning: () => {},
    info: () => {},
    progress: () => {},
    formatTestList: () => {},
    formatTestExecution: () => {},
    formatTestResult: () => {},
    formatJsonOutput: () => {},
    formatJUnitReport: (testSuite: any) => JSON.stringify(testSuite),
    formatError: (error: any) => error.message || String(error),
    ...overrides,
  };
}
