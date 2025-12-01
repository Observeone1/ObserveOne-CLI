import { IProcessService } from "../../interfaces/process.interface.js";

/**
 * Create a stub implementation of IProcessService for testing
 */
export function createProcessStub(
  overrides?: Partial<IProcessService>
): IProcessService {
  const env: Map<string, string> = new Map();

  return {
    exit: (code: number): never => {
      throw new Error(`Process exit called with code ${code}`);
    },
    getEnv: (key: string) => env.get(key),
    setEnv: (key: string, value: string) => {
      env.set(key, value);
    },
    getPlatform: () => "linux",
    getCwd: () => "/test/cwd",
    exec: async () => ({ stdout: "", stderr: "" }),
    ...overrides,
  };
}
