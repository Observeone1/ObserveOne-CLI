import { IFileSystem } from "../interfaces/file-system.interface.js";
import {
  existsSync,
  writeFileSync,
  readFileSync,
  mkdirSync,
  appendFileSync,
} from "fs";

/**
 * Concrete implementation of file system operations
 * Wraps Node.js fs module
 */
export class FileSystemService implements IFileSystem {
  existsSync(path: string): boolean {
    return existsSync(path);
  }

  writeFileSync(
    path: string,
    data: string,
    encoding: BufferEncoding = "utf8"
  ): void {
    writeFileSync(path, data, encoding);
  }

  readFileSync(path: string, encoding: BufferEncoding): string {
    return readFileSync(path, encoding);
  }

  mkdirSync(path: string, options?: { recursive?: boolean }): void {
    mkdirSync(path, options);
  }

  appendFileSync(
    path: string,
    data: string,
    encoding: BufferEncoding = "utf8"
  ): void {
    appendFileSync(path, data, encoding);
  }
}
