import { describe, it, expect } from 'vitest';
import {
  createSslMonitorCommand,
  createTcpMonitorCommand,
  createUdpMonitorCommand,
  createDbMonitorCommand,
} from '../../commands/protocol-monitor.js';
import { IConfigService } from '../../interfaces/config.interface.js';
import { IApiClient } from '../../interfaces/api-client.interface.js';
import { IOutputService } from '../../interfaces/output.interface.js';

const stubConfig = {} as IConfigService;
const stubApi = {} as IApiClient;
const stubOutput = {} as IOutputService;

const builders = {
  'ssl-monitor': { build: createSslMonitorCommand, alias: 'ssl', typeFlag: '--hostname' },
  'tcp-monitor': { build: createTcpMonitorCommand, alias: 'tcp', typeFlag: '--host' },
  'udp-monitor': { build: createUdpMonitorCommand, alias: 'udp', typeFlag: '--host' },
  'db-monitor': { build: createDbMonitorCommand, alias: 'db', typeFlag: '--protocol' },
} as const;

describe('protocol-monitor commands', () => {
  it.each(Object.entries(builders))(
    '%s registers name, alias, and the full CRUD + run surface',
    (name, { build, alias, typeFlag }) => {
      const cmd = build(stubConfig, stubApi, stubOutput);

      expect(cmd.name()).toBe(name);
      expect(cmd.aliases()).toContain(alias);

      const subs = cmd.commands.map((c) => c.name());
      expect(subs).toEqual(
        expect.arrayContaining([
          'list',
          'get',
          'create',
          'update',
          'delete',
          'toggle',
          'run',
          'toggle-muted',
          'runs',
        ])
      );

      const create = cmd.commands.find((c) => c.name() === 'create')!;
      const createFlags = create.options.map((o) => o.long);
      expect(createFlags).toContain(typeFlag);
      expect(createFlags).toContain('--name');
      expect(createFlags).toContain('--no-alerts');
    }
  );

  it('does not expose --no-alerts on update (unspecified alert flag must fall through)', () => {
    const cmd = createSslMonitorCommand(stubConfig, stubApi, stubOutput);
    const update = cmd.commands.find((c) => c.name() === 'update')!;
    const updateFlags = update.options.map((o) => o.long);
    expect(updateFlags).not.toContain('--no-alerts');
    expect(updateFlags).toContain('--hostname');
  });
});
