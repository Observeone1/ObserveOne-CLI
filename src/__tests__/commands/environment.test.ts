import { describe, it, expect } from 'vitest';
import { createEnvironmentCommand } from '../../commands/environment.js';
import { IConfigService } from '../../interfaces/config.interface.js';
import { IApiClient } from '../../interfaces/api-client.interface.js';
import { IOutputService } from '../../interfaces/output.interface.js';

const stubConfig = {} as IConfigService;
const stubApi = {} as IApiClient;
const stubOutput = {} as IOutputService;

describe('environment command', () => {
  const cmd = createEnvironmentCommand(stubConfig, stubApi, stubOutput);

  it('registers name and env alias', () => {
    expect(cmd.name()).toBe('environment');
    expect(cmd.aliases()).toContain('env');
  });

  it('exposes CRUD + secrets but no toggle (environments have no active state)', () => {
    const subs = cmd.commands.map((c) => c.name());
    expect(subs).toEqual(
      expect.arrayContaining(['list', 'get', 'create', 'update', 'delete', 'secrets'])
    );
    expect(subs).not.toContain('toggle');
  });

  it('accepts --project-id on create but not on update', () => {
    const create = cmd.commands.find((c) => c.name() === 'create')!;
    const update = cmd.commands.find((c) => c.name() === 'update')!;
    expect(create.options.map((o) => o.long)).toContain('--project-id');
    expect(update.options.map((o) => o.long)).not.toContain('--project-id');
  });

  it('secrets subcommand takes a repeatable --secret option', () => {
    const secrets = cmd.commands.find((c) => c.name() === 'secrets')!;
    expect(secrets.options.map((o) => o.long)).toContain('--secret');
  });
});
