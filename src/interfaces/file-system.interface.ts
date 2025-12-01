/**
 * File System interface
 * Abstracts filesystem operations for testability
 */
export interface IFileSystem {
  existsSync(path: string): boolean;
  writeFileSync(path: string, data: string, encoding?: BufferEncoding): void;
  readFileSync(path: string, encoding: BufferEncoding): string;
  mkdirSync(path: string, options?: { recursive?: boolean }): void;
  appendFileSync(path: string, data: string, encoding?: BufferEncoding): void;
}
