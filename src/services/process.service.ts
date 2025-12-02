import { IProcessService } from "../interfaces/process.interface.js";
import { exec as execCallback } from "child_process";
import { promisify } from "util";

const execAsync = promisify(execCallback);

/**
 * Concrete implementation of process operations
 * Wraps Node.js process and child_process modules
 */
export class ProcessService implements IProcessService {
  exit(code: number): never {
    process.exit(code);
  }

  getEnv(key: string): string | undefined {
    return process.env[key];
  }

  setEnv(key: string, value: string): void {
    process.env[key] = value;
  }

  getPlatform(): NodeJS.Platform {
    return process.platform;
  }

  getCwd(): string {
    return process.cwd();
  }

  async exec(command: string): Promise<{ stdout: string; stderr: string }> {
    return await execAsync(command);
  }
}
