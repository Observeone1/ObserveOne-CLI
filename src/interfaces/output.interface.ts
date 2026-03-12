import {
  Test,
  TestExecution,
  TestResult,
  UrlMonitor,
  ApiCheck,
  Heartbeat,
} from '../types/index.js';

/**
 * Output formatting service interface
 */
export interface IOutputService {
  success(message: string): void;
  error(message: string): void;
  warning(message: string): void;
  info(message: string): void;
  progress(message: string): void;
  enableJsonMode(): void;

  formatTestList(tests: Test[], verbose?: boolean): void;
  formatMonitorList(monitors: UrlMonitor[], verbose?: boolean): void;
  formatApiCheckList(checks: ApiCheck[], verbose?: boolean): void;
  formatHeartbeatList(heartbeats: Heartbeat[], verbose?: boolean): void;

  formatTestExecution(execution: TestExecution): void;
  formatTestResult(result: TestResult): void;
  formatJsonOutput(data: any): void;
  formatJUnitReport(testSuite: any): string;
  formatError(error: any): string;
}
