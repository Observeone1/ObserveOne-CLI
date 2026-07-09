import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveSchema } from '../../utils/schemas.js';
import {
  buildDefaultCreatePrompts,
  buildDefaultUpdatePrompts,
} from '../../utils/schema-prompts.js';
import { IOutputService } from '../../interfaces/output.interface.js';

vi.mock('inquirer', () => ({ default: { prompt: vi.fn() } }));
import inquirer from 'inquirer';
const promptMock = inquirer.prompt as unknown as ReturnType<typeof vi.fn>;

const stubOutput = () =>
  ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }) as unknown as IOutputService;

beforeEach(() => {
  promptMock.mockReset();
  Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
});

describe('environment schema', () => {
  it('requires only name', () => {
    expect(resolveSchema('environment')!.required).toEqual(['name']);
  });

  it('marks project_id as create-only (not updatable)', () => {
    const meta = resolveSchema('environment')!.fieldMetadata!;
    expect(meta.project_id!.updatable).toBe(false);
  });
});

describe('environment create payload', () => {
  it('parses --var pairs into a variables map and includes project_id', async () => {
    const generator = buildDefaultCreatePrompts(resolveSchema('environment')!);
    const payload = (await generator({
      name: 'prod',
      baseUrl: 'https://api.example.com',
      projectId: 'p-123',
      var: ['REGION=us-east', 'TIER=paid'],
    })) as Record<string, unknown>;

    expect(promptMock).not.toHaveBeenCalled();
    expect(payload.name).toBe('prod');
    expect(payload.base_url).toBe('https://api.example.com');
    expect(payload.project_id).toBe('p-123');
    expect(payload.variables).toEqual({ REGION: 'us-east', TIER: 'paid' });
  });
});

describe('environment update payload', () => {
  it('omits project_id and preserves existing variables when --var is not passed', async () => {
    const generator = buildDefaultUpdatePrompts(resolveSchema('environment')!, stubOutput());
    const existing = {
      id: 'e1',
      name: 'prod',
      project_id: 'p-123',
      variables: { REGION: 'us-east' },
    };

    // Only --name passed; --var defaults to [] (treated as absent).
    const payload = (await generator('e1', { name: 'prod-2', var: [] }, existing)) as Record<
      string,
      unknown
    >;

    expect(payload.name).toBe('prod-2');
    expect(payload.project_id).toBeUndefined();
    expect(payload.variables).toEqual({ REGION: 'us-east' });
  });

  it('replaces variables when --var is passed', async () => {
    const generator = buildDefaultUpdatePrompts(resolveSchema('environment')!, stubOutput());
    const existing = { id: 'e1', name: 'prod', variables: { OLD: '1' } };

    const payload = (await generator('e1', { var: ['NEW=2'] }, existing)) as Record<
      string,
      unknown
    >;

    expect(payload.variables).toEqual({ NEW: '2' });
  });
});
