import { describe, it, expect } from 'vitest';
import { createApiKeyCommand } from '../../commands/api-key.js';
import { IConfigService } from '../../interfaces/config.interface.js';
import { IApiClient } from '../../interfaces/api-client.interface.js';
import { IOutputService } from '../../interfaces/output.interface.js';

const stubConfig = {} as IConfigService;
const stubApi = {} as IApiClient;
const stubOutput = {} as IOutputService;

describe('api-key command', () => {
  const cmd = createApiKeyCommand(stubConfig, stubApi, stubOutput);

  it('registers name', () => {
    expect(cmd.name()).toBe('api-key');
  });

  it('exposes list, create, revoke (delete alias), toggle, rotate, scopes', () => {
    const subs = cmd.commands.map((c) => c.name());
    expect(subs).toEqual(
      expect.arrayContaining(['list', 'create', 'revoke', 'toggle', 'rotate', 'scopes'])
    );
    const revoke = cmd.commands.find((c) => c.name() === 'revoke')!;
    expect(revoke.aliases()).toContain('delete');
  });

  it('create accepts --name and a repeatable --scope', () => {
    const create = cmd.commands.find((c) => c.name() === 'create')!;
    const longs = create.options.map((o) => o.long);
    expect(longs).toEqual(expect.arrayContaining(['--name', '--scope']));
    const scopeOption = create.options.find((o) => o.long === '--scope')!;
    // Third ctor arg (collectOptionValues) + default [] is what makes it repeatable/array-valued.
    expect(scopeOption.defaultValue).toEqual([]);
  });
});
