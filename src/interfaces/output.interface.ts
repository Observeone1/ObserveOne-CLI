import {
  UrlMonitor,
  ApiCheck,
  Heartbeat,
  AlertChannel,
  StatusPage,
  Incident,
  Environment,
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

  formatMonitorList(monitors: UrlMonitor[], verbose?: boolean): void;
  formatApiCheckList(checks: ApiCheck[], verbose?: boolean): void;
  formatHeartbeatList(heartbeats: Heartbeat[], verbose?: boolean): void;
  formatEnvironmentList(environments: Environment[], verbose?: boolean): void;
  formatAlertChannelList(channels: AlertChannel[], verbose?: boolean): void;
  formatStatusPageList(statusPages: StatusPage[], verbose?: boolean): void;
  formatIncidentList(incidents: Incident[], verbose?: boolean): void;

  formatJsonOutput(data: unknown): void;
  formatJUnitReport(testSuite: {
    name: string;
    tests: number;
    failures: number;
    errors: number;
    time: string;
    testCases: Array<{
      name: string;
      classname: string;
      time: string;
      status: string;
      failure?:
        | {
            message: string;
            type: string;
            stackTrace?: string | undefined;
          }
        | undefined;
    }>;
  }): string;
  formatError(error: unknown): string;
}
