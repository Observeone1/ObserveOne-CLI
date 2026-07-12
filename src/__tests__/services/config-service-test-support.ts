import { vi } from 'vitest';

/** Shape of the injected Conf mock shared by ConfigService specs. */
export interface MockConf {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
  path: string;
}

/** A ready-to-use MockConf for injecting into `new ConfigService(mockConf)`. */
export function createMockConf(): MockConf {
  return {
    get: vi.fn().mockReturnValue(undefined),
    set: vi.fn(),
    delete: vi.fn(),
    clear: vi.fn(),
    path: '/mock/path/config.json',
  };
}
