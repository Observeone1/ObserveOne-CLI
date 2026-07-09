import { describe, it, expect } from 'vitest';
import { createApiCollectionCommand } from '../../commands/api-collection.js';
import { resolveSchema } from '../../utils/schemas.js';
import { IConfigService } from '../../interfaces/config.interface.js';
import { IApiClient } from '../../interfaces/api-client.interface.js';
import { IOutputService } from '../../interfaces/output.interface.js';

const stubConfig = {} as IConfigService;
const stubApi = {} as IApiClient;
const stubOutput = {} as IOutputService;

describe('api-collection command', () => {
  const cmd = createApiCollectionCommand(stubConfig, stubApi, stubOutput);

  it('registers name and collection alias', () => {
    expect(cmd.name()).toBe('api-collection');
    expect(cmd.aliases()).toContain('collection');
  });

  it('exposes CRUD but no toggle', () => {
    const subs = cmd.commands.map((c) => c.name());
    expect(subs).toEqual(expect.arrayContaining(['list', 'get', 'create', 'update', 'delete']));
    expect(subs).not.toContain('toggle');
  });

  it('create/update accept --name, --base-url, --header', () => {
    for (const name of ['create', 'update']) {
      const sub = cmd.commands.find((c) => c.name() === name)!;
      const longs = sub.options.map((o) => o.long);
      expect(longs).toEqual(expect.arrayContaining(['--name', '--base-url', '--header']));
    }
  });

  it('schema requires only name', () => {
    expect(resolveSchema('api-collection')!.required).toEqual(['name']);
  });
});
