// Jest setup file
import 'jest';

// Mock console methods to avoid cluttering test output
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
};

// Mock process.exit to prevent tests from actually exiting
const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
  throw new Error(`process.exit(${code})`);
});

// Mock process.cwd
jest.spyOn(process, 'cwd').mockReturnValue('/mock/project/path');

// Mock fs methods
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

// Mock path
jest.mock('path', () => ({
  join: (...args: string[]) => args.join('/'),
  resolve: (...args: string[]) => args.join('/'),
}));
