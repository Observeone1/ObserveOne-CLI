import { describe, it, expect } from 'vitest';
import { createProjectCommand } from '../../commands/project.js';
import { resolveSchema } from '../../utils/schemas.js';
import { IConfigService } from '../../interfaces/config.interface.js';
import { IApiClient } from '../../interfaces/api-client.interface.js';
import { IOutputService } from '../../interfaces/output.interface.js';

const stubConfig = {} as IConfigService;
const stubApi = {} as IApiClient;
const stubOutput = {} as IOutputService;

describe('project command', () => {
  const cmd = createProjectCommand(stubConfig, stubApi, stubOutput);

  it('is named project', () => {
    expect(cmd.name()).toBe('project');
  });

  it('exposes CRUD but no toggle (projects have no active state)', () => {
    const subs = cmd.commands.map((c) => c.name());
    expect(subs).toEqual(expect.arrayContaining(['list', 'get', 'create', 'update', 'delete']));
    expect(subs).not.toContain('toggle');
  });

  it('create/update accept --name and --description', () => {
    const create = cmd.commands.find((c) => c.name() === 'create')!;
    const update = cmd.commands.find((c) => c.name() === 'update')!;
    expect(create.options.map((o) => o.long)).toEqual(
      expect.arrayContaining(['--name', '--description'])
    );
    expect(update.options.map((o) => o.long)).toEqual(
      expect.arrayContaining(['--name', '--description'])
    );
  });

  it('schema requires only name', () => {
    expect(resolveSchema('project')!.required).toEqual(['name']);
  });
});
