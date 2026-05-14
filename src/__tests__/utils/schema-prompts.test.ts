import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildDefaultCreatePrompts,
  buildDefaultUpdatePrompts,
} from '../../utils/schema-prompts.js';
import { schemas } from '../../utils/schemas.js';
import { IOutputService } from '../../interfaces/output.interface.js';

vi.mock('inquirer', () => ({
  default: { prompt: vi.fn() },
}));

import inquirer from 'inquirer';
const promptMock = inquirer.prompt as unknown as ReturnType<typeof vi.fn>;

const stubOutputService = (): IOutputService =>
  ({
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    progress: vi.fn(),
    enableJsonMode: vi.fn(),
    formatJsonOutput: vi.fn(),
    formatError: vi.fn(),
  }) as unknown as IOutputService;

beforeEach(() => {
  promptMock.mockReset();
  // Pretend stdin is a TTY for tests so requireTTY doesn't exit.
  Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
});

describe('buildDefaultCreatePrompts', () => {
  it('prompts for required fields missing from options', async () => {
    promptMock.mockResolvedValueOnce({ name: 'My Monitor', url: 'https://example.com' });
    const generator = buildDefaultCreatePrompts(schemas.monitor!);

    const payload = await generator({});

    expect(promptMock).toHaveBeenCalledTimes(1);
    const questions = promptMock.mock.calls[0]![0] as Array<{ name: string }>;
    const promptedFields = questions.map((q) => q.name);
    expect(promptedFields).toEqual(expect.arrayContaining(['name', 'url']));
    expect(payload).toEqual(
      expect.objectContaining({
        name: 'My Monitor',
        url: 'https://example.com',
        interval: '*/5 * * * *',
        alert_on_failure: true,
        timeout_ms: 30000,
      })
    );
  });

  it('skips prompts when all required fields are passed via flags', async () => {
    const generator = buildDefaultCreatePrompts(schemas.monitor!);

    const payload = await generator({
      name: 'CLI Monitor',
      url: 'https://example.com',
      interval: '*/10 * * * *',
    });

    expect(promptMock).not.toHaveBeenCalled();
    expect(payload).toEqual(
      expect.objectContaining({
        name: 'CLI Monitor',
        url: 'https://example.com',
        interval: '*/10 * * * *',
        alert_on_failure: true,
        timeout_ms: 30000,
      })
    );
  });

  it('applies transformer to inquirer numeric answers and to CLI string values', async () => {
    // Inquirer answers are keyed by question.name = API field key, so the
    // heartbeat grace prompt resolves to `grace_period: 30`, not `grace: 30`.
    promptMock.mockResolvedValueOnce({ name: 'hb', period: 120, grace_period: 30 });
    const generator = buildDefaultCreatePrompts(schemas.heartbeat!);

    const payload = await generator({});

    expect(payload).toEqual(expect.objectContaining({ name: 'hb', period: 120, grace_period: 30 }));

    promptMock.mockReset();

    // CLI strings → transformer parses to int.
    const fromCli = await generator({ name: 'cli-hb', period: '90', grace: '15' });
    expect(promptMock).not.toHaveBeenCalled();
    expect(fromCli).toEqual(
      expect.objectContaining({ name: 'cli-hb', period: 90, grace_period: 15 })
    );
  });

  it('maps flagName to API field name (heartbeat: --grace → grace_period)', async () => {
    const generator = buildDefaultCreatePrompts(schemas.heartbeat!);

    const payload = await generator({ name: 'x', period: '60', grace: '5' });

    expect(payload).toHaveProperty('grace_period', 5);
    expect(payload).not.toHaveProperty('grace');
  });

  it('emits defaults for optional fields with no flag passed', async () => {
    const generator = buildDefaultCreatePrompts(schemas.monitor!);

    const payload = await generator({ name: 'm', url: 'https://example.com' });

    expect(payload).toEqual(
      expect.objectContaining({
        interval: '*/5 * * * *',
        alert_on_failure: true,
        timeout_ms: 30000,
      })
    );
  });

  it('uppercase transformer normalizes HTTP method', async () => {
    const generator = buildDefaultCreatePrompts(schemas.check!);

    const payload = await generator({
      name: 'c',
      url: 'https://api.example.com',
      method: 'post',
    });

    expect(payload).toHaveProperty('method', 'POST');
  });
});

describe('buildDefaultUpdatePrompts', () => {
  it('errors when no updatable flag is passed', async () => {
    const outputService = stubOutputService();
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit(${code ?? 0})`);
    }) as never);

    const generator = buildDefaultUpdatePrompts(schemas.monitor!, outputService);

    await expect(
      generator(1, {}, { id: 1, name: 'existing', url: 'https://existing.com' })
    ).rejects.toThrow(/process\.exit/);
    expect(outputService.error).toHaveBeenCalledWith(
      expect.stringContaining('Please provide at least one field to update')
    );

    exitSpy.mockRestore();
  });

  it('pre-fills from existing when flag not passed', async () => {
    const outputService = stubOutputService();
    const generator = buildDefaultUpdatePrompts(schemas.monitor!, outputService);

    const payload = await generator(1, { name: 'new-name' }, {
      id: 1,
      name: 'old-name',
      url: 'https://example.com',
      interval: '*/15 * * * *',
      alert_on_failure: false,
      timeout_ms: 60000,
    } as never);

    expect(payload).toEqual(
      expect.objectContaining({
        name: 'new-name',
        url: 'https://example.com',
        interval: '*/15 * * * *',
        alert_on_failure: false,
        timeout_ms: 60000,
      })
    );
  });

  it('applies transformer to passed flag value, leaves existing untouched', async () => {
    const outputService = stubOutputService();
    const generator = buildDefaultUpdatePrompts(schemas.heartbeat!, outputService);

    const payload = await generator(1, { period: '600' }, {
      id: 1,
      name: 'hb',
      period: 300,
      grace_period: 60,
    } as never);

    expect(payload).toEqual(expect.objectContaining({ name: 'hb', period: 600, grace_period: 60 }));
  });
});

describe('schema consistency', () => {
  it('every name in `required` has fieldMetadata that guarantees a payload value', () => {
    // "Required" means the field must end up in the create payload. That's
    // satisfied either by forcing user input (requiredOnCreate) OR by
    // having a default (e.g. check.method silently falls back to "GET").
    for (const [resourceName, schema] of Object.entries(schemas)) {
      const meta = schema.fieldMetadata;
      if (!meta) continue;
      for (const requiredField of schema.required) {
        const fieldMeta = meta[requiredField];
        expect(fieldMeta, `${resourceName}.fieldMetadata.${requiredField} missing`).toBeDefined();
        const hasGuarantee =
          fieldMeta!.requiredOnCreate === true || fieldMeta!.default !== undefined;
        expect(
          hasGuarantee,
          `${resourceName}.${requiredField} must have requiredOnCreate: true OR a default`
        ).toBe(true);
      }
    }
  });

  it('every fieldMetadata entry with requiredOnCreate has an inquirerType', () => {
    for (const [resourceName, schema] of Object.entries(schemas)) {
      const meta = schema.fieldMetadata;
      if (!meta) continue;
      for (const [field, fieldMeta] of Object.entries(meta)) {
        if (!fieldMeta.requiredOnCreate) continue;
        expect(
          fieldMeta.inquirerType,
          `${resourceName}.${field} requiredOnCreate but no inquirerType`
        ).toBeDefined();
      }
    }
  });

  it('list-type fields have choices defined', () => {
    for (const [resourceName, schema] of Object.entries(schemas)) {
      const meta = schema.fieldMetadata;
      if (!meta) continue;
      for (const [field, fieldMeta] of Object.entries(meta)) {
        if (fieldMeta.inquirerType !== 'list') continue;
        expect(
          fieldMeta.choices,
          `${resourceName}.${field} is list-type but has no choices`
        ).toBeDefined();
        expect((fieldMeta.choices ?? []).length).toBeGreaterThan(0);
      }
    }
  });
});

describe('schema introspection (buildJsonSchema backward compat)', () => {
  it('returns 7 named resources', () => {
    expect(Object.keys(schemas)).toEqual(
      expect.arrayContaining([
        'monitor',
        'check',
        'heartbeat',
        'alert-channel',
        'status-page',
        'incident',
        'ai-check',
      ])
    );
  });

  it('every resource still exposes required + template (back-compat for validate/init/templates/schema)', () => {
    for (const [resourceName, schema] of Object.entries(schemas)) {
      expect(Array.isArray(schema.required), `${resourceName}.required not an array`).toBe(true);
      expect(typeof schema.template, `${resourceName}.template not an object`).toBe('object');
    }
  });
});
