import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildDefaultCreatePrompts,
  buildDefaultUpdatePrompts,
} from '../../utils/schema-prompts.js';
import { ResourceSchema } from '../../utils/schemas.js';
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
  Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
});

/**
 * The real resource schemas always define fieldMetadata, labels and inquirer
 * types, so the builders' own defaults are only reachable through hand-built
 * schemas. These cases pin those defaults down.
 */
describe('prompt builders with a metadata-less schema', () => {
  const bareSchema = {
    description: 'bare',
    required: [],
    template: {},
  } as unknown as ResourceSchema;

  it('buildDefaultCreatePrompts returns an empty payload and prompts for nothing', async () => {
    const payload = await buildDefaultCreatePrompts(bareSchema)({});
    expect(promptMock).not.toHaveBeenCalled();
    expect(payload).toEqual({});
  });

  it('buildDefaultUpdatePrompts errors without a field hint when nothing is updatable', async () => {
    const outputService = stubOutputService();
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('exit');
    }) as never);

    await expect(
      buildDefaultUpdatePrompts(bareSchema, outputService)('id-1', {}, {} as never)
    ).rejects.toThrow('exit');

    expect(outputService.error).toHaveBeenCalledWith(
      'Please provide at least one field to update.'
    );
    exit.mockRestore();
  });
});

describe('toInquirerQuestion defaults', () => {
  it('falls back to an input question with a "<field>:" message and no choices', async () => {
    const schema = {
      description: 'minimal',
      required: ['title'],
      template: {},
      fieldMetadata: {
        title: { requiredOnCreate: true, inquirerType: 'input' },
      },
    } as unknown as ResourceSchema;

    promptMock.mockResolvedValueOnce({ title: 'from prompt' });
    const payload = await buildDefaultCreatePrompts(schema)({});

    const questions = promptMock.mock.calls[0]![0] as Array<Record<string, unknown>>;
    expect(questions).toHaveLength(1);
    expect(questions[0]).toMatchObject({ type: 'input', name: 'title', message: 'title:' });
    expect(questions[0]).not.toHaveProperty('choices');
    expect(questions[0]).not.toHaveProperty('default');
    expect(payload).toEqual({ title: 'from prompt' });
  });

  it('skips a promptable field whose flag was already supplied', async () => {
    const schema = {
      description: 'minimal',
      required: ['title', 'body'],
      template: {},
      fieldMetadata: {
        title: { requiredOnCreate: true, inquirerType: 'input', flagName: 'title' },
        body: { requiredOnCreate: true, inquirerType: 'input', flagName: 'body' },
      },
    } as unknown as ResourceSchema;

    promptMock.mockResolvedValueOnce({ body: 'from prompt' });
    const payload = await buildDefaultCreatePrompts(schema)({ title: 'from flag' });

    const questions = promptMock.mock.calls[0]![0] as Array<Record<string, unknown>>;
    expect(questions.map((q) => q.name)).toEqual(['body']);
    expect(payload).toEqual({ title: 'from flag', body: 'from prompt' });
  });

  it('carries label, choices and default through to the question', async () => {
    const schema = {
      description: 'minimal',
      required: ['mode'],
      template: {},
      fieldMetadata: {
        mode: {
          requiredOnCreate: true,
          inquirerType: 'list',
          label: 'Pick a mode',
          choices: ['fast', 'slow'],
          default: 'fast',
        },
      },
    } as unknown as ResourceSchema;

    promptMock.mockResolvedValueOnce({ mode: 'slow' });
    await buildDefaultCreatePrompts(schema)({});

    const questions = promptMock.mock.calls[0]![0] as Array<Record<string, unknown>>;
    expect(questions[0]).toMatchObject({
      type: 'list',
      message: 'Pick a mode',
      choices: ['fast', 'slow'],
      default: 'fast',
    });
  });
});

describe('buildDefaultUpdatePrompts payload assembly', () => {
  const schema = {
    description: 'minimal',
    required: [],
    template: {},
    extraUpdateTriggers: ['force'],
    fieldMetadata: {
      name: { flagName: 'name' },
      retries: { flagName: 'retries', default: 3 },
      note: { flagName: 'note' },
    },
  } as unknown as ResourceSchema;

  it('accepts an extraUpdateTriggers flag as the only reason to proceed', async () => {
    const payload = await buildDefaultUpdatePrompts(schema, stubOutputService())(
      'id-1',
      { force: true },
      { name: 'existing' } as never
    );

    expect(payload).toEqual({ name: 'existing', retries: 3 });
  });

  it('keeps existing values, applies defaults, and drops fields with neither', async () => {
    const payload = await buildDefaultUpdatePrompts(schema, stubOutputService())(
      'id-1',
      { name: 'new name' },
      { note: null } as never
    );

    expect(payload).toEqual({ name: 'new name', retries: 3 });
  });

  it('treats a missing existing record as empty', async () => {
    const payload = await buildDefaultUpdatePrompts(schema, stubOutputService())(
      'id-1',
      { name: 'only flag' },
      undefined as never
    );

    expect(payload).toEqual({ name: 'only flag', retries: 3 });
  });
});
