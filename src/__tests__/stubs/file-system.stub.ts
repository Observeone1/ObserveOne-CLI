import { IFileSystem } from "../../interfaces/file-system.interface.js";

/**
 * Create a stub implementation of IFileSystem for testing
 */
export function createFileSystemStub(
  overrides?: Partial<IFileSystem>
): IFileSystem {
  const files: Map<string, string> = new Map();

  return {
    existsSync: (path: string) => files.has(path),
    writeFileSync: (path: string, data: string) => {
      files.set(path, data);
    },
    readFileSync: (path: string) => files.get(path) || "",
    mkdirSync: () => {},
    appendFileSync: (path: string, data: string) => {
      const existing = files.get(path) || "";
      files.set(path, existing + data);
    },
    ...overrides,
  };
}
