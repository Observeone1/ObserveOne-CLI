/**
 * Process service interface
 * Abstracts process and child_process operations for testability
 */
export interface IProcessService {
  exit(code: number): never;
  getEnv(key: string): string | undefined;
  setEnv(key: string, value: string): void;
  getPlatform(): NodeJS.Platform;
  getCwd(): string;
  exec(command: string): Promise<{ stdout: string; stderr: string }>;
}
